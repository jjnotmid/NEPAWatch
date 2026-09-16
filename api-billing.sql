-- Run once in Supabase SQL Editor
-- Flutterwave monthly billing for Pro API subscriptions (₦5,000/month)

CREATE TABLE IF NOT EXISTS api_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  email       text NOT NULL,
  flw_plan_id text,
  flw_sub_id  text UNIQUE,
  tx_ref      text UNIQUE NOT NULL,
  last_tx_id  text,               -- idempotency: never double-extend on webhook retries
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','active','past_due','cancelled')),
  renews_at   timestamptz,
  price       numeric NOT NULL DEFAULT 5000,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_subs_email  ON api_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_api_subs_txref  ON api_subscriptions(tx_ref);
CREATE INDEX IF NOT EXISTS idx_api_subs_keyid  ON api_subscriptions(api_key_id);

ALTER TABLE api_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_subs_service_only" ON api_subscriptions;
CREATE POLICY "api_subs_service_only" ON api_subscriptions
  USING (true) WITH CHECK (true); -- edge function uses service role key, bypasses RLS
