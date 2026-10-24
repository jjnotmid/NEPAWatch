-- Run in the NEPAWatch Supabase SQL Editor before deploying admin-action
-- and developer-portal. Complimentary Starter grants have no expiry.
BEGIN;

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS partner_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_grant_reason text;

-- Called only by admin-action with the authenticated admin's user ID.
-- Keep the entitlement change and its attribution in the same transaction.
CREATE OR REPLACE FUNCTION public.grant_partner_starter(
  p_key_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_daily_limit int DEFAULT 1000
)
RETURNS TABLE (id uuid, tier text, status text, daily_limit int, partner_granted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target public.api_keys%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A partnership reason of 3 to 500 characters is required' USING ERRCODE = '22023';
  END IF;
  IF p_daily_limit IS NULL OR p_daily_limit < 1 THEN
    RAISE EXCEPTION 'Invalid Starter daily limit' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target FROM public.api_keys WHERE api_keys.id = p_key_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'API key not found' USING ERRCODE = 'P0002';
  END IF;
  IF target.status NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'Revoked keys cannot receive a partnership grant';
  END IF;
  IF EXISTS (SELECT 1 FROM public.api_subscriptions WHERE api_key_id = p_key_id) THEN
    RAISE EXCEPTION 'This key has billing records. Use a free key without a checkout for the partnership';
  END IF;

  -- A retry succeeds without changing the original admin, reason or quota.
  IF target.tier = 'starter' AND target.status = 'active' AND target.partner_granted_at IS NOT NULL THEN
    RETURN QUERY SELECT target.id, target.tier, target.status, target.daily_limit, target.partner_granted_at;
    RETURN;
  END IF;
  IF target.tier <> 'free' THEN
    RAISE EXCEPTION 'Only free keys can be upgraded to complimentary Starter';
  END IF;

  RETURN QUERY
  UPDATE public.api_keys AS k SET
    tier = 'starter',
    status = 'active',
    daily_limit = p_daily_limit,
    approved_at = COALESCE(k.approved_at, now()),
    revoked_at = NULL,
    partner_granted_at = now(),
    partner_granted_by = p_admin_id,
    partner_grant_reason = btrim(p_reason)
  WHERE k.id = p_key_id
  RETURNING k.id, k.tier, k.status, k.daily_limit, k.partner_granted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_partner_starter(uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_partner_starter(uuid, uuid, text, int) TO service_role;

COMMIT;
