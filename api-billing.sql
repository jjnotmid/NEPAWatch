-- Run once in Supabase SQL Editor
-- Flutterwave monthly billing for Pro API subscriptions

-- Keep the API key tiers in sync with the plans offered by api-billing.
-- The original schema only allowed free/pro, which blocked starter, scale,
-- and business checkouts before Flutterwave could open.
ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_tier_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('free','starter','pro','scale','business'));

CREATE TABLE IF NOT EXISTS api_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  email         text NOT NULL,
  tier          text NOT NULL DEFAULT 'pro'
                CHECK (tier IN ('starter','pro','scale','business')),
  flw_plan_id   text,
  flw_sub_id    text UNIQUE,
  tx_ref        text UNIQUE NOT NULL,
  last_tx_id    text,             -- idempotency: never double-extend on retries
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','past_due','cancelled')),
  grace_ends_at timestamptz,      -- 7-day grace after a failed charge, then revoke
  renews_at     timestamptz,
  checkout_url  text,
  checkout_expires_at timestamptz,
  price         numeric NOT NULL DEFAULT 5000,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_subs_email  ON api_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_api_subs_txref  ON api_subscriptions(tx_ref);
CREATE INDEX IF NOT EXISTS idx_api_subs_keyid  ON api_subscriptions(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_subs_pending_created
  ON api_subscriptions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_api_subs_past_due_grace
  ON api_subscriptions(grace_ends_at) WHERE status = 'past_due';

ALTER TABLE api_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_subs_service_only" ON api_subscriptions;
-- No client policy: billing is managed only by Edge Functions using the
-- service role, which bypasses RLS. A USING (true) policy would expose all rows.
REVOKE ALL ON TABLE public.api_subscriptions FROM anon, authenticated;

-- Per-key daily request cap (tier is set at activation; the gateway reads this)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS daily_limit int NOT NULL DEFAULT 100;
ALTER TABLE api_subscriptions ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE api_subscriptions ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz;
