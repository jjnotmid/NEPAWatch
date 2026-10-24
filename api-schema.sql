-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  developer_name TEXT NOT NULL,
  app_name TEXT,
  email TEXT NOT NULL,
  use_case TEXT,
  key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'scale', 'business')),
  daily_limit INT NOT NULL DEFAULT 100,
  requests_today INT NOT NULL DEFAULT 0,
  total_requests BIGINT NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  partner_granted_at TIMESTAMPTZ,
  partner_granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_grant_reason TEXT
);

-- API Request Logs table
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT,
  query_params TEXT,
  status_code INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- API keys are issued only by server-side Edge Functions. Public inserts
-- would let callers choose their own tier, status, and daily limit.
DROP POLICY IF EXISTS "api_keys_public_insert" ON api_keys;
REVOKE ALL ON TABLE public.api_keys FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

-- One free key per account. Paid keys are governed by their subscription.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_one_active_free_per_user
  ON public.api_keys(user_id)
  WHERE user_id IS NOT NULL AND tier = 'free' AND status = 'active';

-- Atomically validates a key and reserves one request. Row locking prevents
-- concurrent requests from racing past the daily limit or losing increments.
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
