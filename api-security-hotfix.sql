-- NEPAWatch API security and billing hotfix
-- Run once in Supabase SQL Editor before deploying the hardened Edge Functions.

BEGIN;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS daily_limit int NOT NULL DEFAULT 100;

-- Keep the stored constraint aligned with every tier sold by api-billing.
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('free','starter','pro','scale','business'));

DROP POLICY IF EXISTS "api_keys_public_insert" ON public.api_keys;
REVOKE ALL ON TABLE public.api_keys FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

ALTER TABLE public.api_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_subscriptions ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE public.api_subscriptions ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz;
DROP POLICY IF EXISTS "api_subs_service_only" ON public.api_subscriptions;
REVOKE ALL ON TABLE public.api_subscriptions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_api_subs_pending_created
  ON public.api_subscriptions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_api_subs_past_due_grace
  ON public.api_subscriptions(grace_ends_at) WHERE status = 'past_due';

-- Keep the most recently used free key active when an account already has
-- several. This makes the database enforce the one-free-key rule during races.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY last_request_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS position
  FROM public.api_keys
  WHERE user_id IS NOT NULL AND tier = 'free' AND status = 'active'
)
UPDATE public.api_keys AS k
SET status = 'revoked', revoked_at = now()
FROM ranked AS r
WHERE k.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_one_active_free_per_user
  ON public.api_keys(user_id)
  WHERE user_id IS NOT NULL AND tier = 'free' AND status = 'active';

-- Retire checkout attempts that predate the new one-hour checkout window.
WITH cancelled AS (
  UPDATE public.api_subscriptions
  SET status = 'cancelled'
  WHERE status = 'pending' AND created_at < now() - interval '1 hour'
  RETURNING api_key_id
)
UPDATE public.api_keys AS k
SET status = 'revoked', revoked_at = now()
WHERE k.status = 'pending' AND k.id IN (SELECT api_key_id FROM cancelled);

-- Validate a key and reserve one request in the same locked transaction.
CREATE OR REPLACE FUNCTION public.consume_api_quota(p_key text)
RETURNS TABLE (
  id uuid,
  status text,
  tier text,
  daily_limit int,
  requests_today int,
  total_requests bigint,
  allowed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  k public.api_keys%ROWTYPE;
  utc_today date := (now() AT TIME ZONE 'UTC')::date;
  used_today int;
BEGIN
  SELECT * INTO k FROM public.api_keys WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  used_today := CASE WHEN k.last_reset_date = utc_today
    THEN COALESCE(k.requests_today, 0) ELSE 0 END;

  IF k.status <> 'active' OR used_today >= k.daily_limit THEN
    RETURN QUERY SELECT k.id, k.status, k.tier, k.daily_limit,
      used_today, COALESCE(k.total_requests, 0), false;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.api_keys AS a SET
    requests_today = used_today + 1,
    total_requests = COALESCE(a.total_requests, 0) + 1,
    last_request_at = now(),
    last_reset_date = utc_today
  WHERE a.id = k.id
  RETURNING a.id, a.status, a.tier, a.daily_limit,
    a.requests_today, a.total_requests, true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_quota(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(text) TO service_role;

COMMIT;

-- Expected: false for every privilege below.
SELECT
  has_table_privilege('anon', 'public.api_keys', 'INSERT') AS anon_can_insert_keys,
  has_table_privilege('authenticated', 'public.api_keys', 'INSERT') AS users_can_insert_keys,
  has_table_privilege('anon', 'public.api_subscriptions', 'SELECT') AS anon_can_read_billing,
  has_table_privilege('authenticated', 'public.api_subscriptions', 'SELECT') AS users_can_read_billing;
