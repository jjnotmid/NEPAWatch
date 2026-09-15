-- Run this once in Supabase SQL Editor
-- Creates/updates the electricity_transactions table for the Flutterwave-only flow

CREATE TABLE IF NOT EXISTS electricity_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text UNIQUE NOT NULL,   -- Flutterwave payment tx_ref
  bill_ref      text,                   -- Flutterwave bill payment reference
  provider      text,
  meter_number  text,
  meter_type    text DEFAULT 'prepaid',
  amount        numeric,
  email         text,
  status        text DEFAULT 'pending', -- pending | pending_bill | success | failed
  token         text,
  units         text,
  error         text,
  created_at    timestamptz DEFAULT now()
);

-- Add bill_ref if the table already exists without it
ALTER TABLE electricity_transactions ADD COLUMN IF NOT EXISTS bill_ref text;

-- Service fee tracking.
--   amount      = value that reaches the meter
--   service_fee = NEPAWatch margin
--   total_paid  = what the customer was actually charged
ALTER TABLE electricity_transactions ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0;
ALTER TABLE electricity_transactions ADD COLUMN IF NOT EXISTS total_paid  numeric;

-- Revenue view: fee income per day, net of the processor's own cut.
-- Flutterwave local cards: 1.4%, capped at NGN2,000, and waived entirely
-- below NGN2,500. Confirm against your live pricing before relying on the
-- net_revenue column for anything financial.
CREATE OR REPLACE VIEW vw_electricity_revenue
  WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', created_at)::date       AS day,
  count(*)                                  AS transactions,
  sum(amount)                               AS units_vended,
  sum(service_fee)                          AS gross_fee,
  sum(
    CASE WHEN total_paid < 2500 THEN 0
         ELSE LEAST(0.014 * total_paid, 2000)
    END
  )                                         AS processor_cost,
  sum(service_fee) - sum(
    CASE WHEN total_paid < 2500 THEN 0
         ELSE LEAST(0.014 * total_paid, 2000)
    END
  )                                         AS net_revenue
FROM electricity_transactions
WHERE status = 'success' AND total_paid IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

-- Admin dashboard totals: delivered count, total processed (money in),
-- and fees earned (your margin). One row, always current.
CREATE OR REPLACE VIEW vw_electricity_totals
  WITH (security_invoker = true)
AS
SELECT
  count(*) FILTER (WHERE status = 'success')                      AS delivered,
  coalesce(sum(total_paid)  FILTER (WHERE status = 'success'), 0) AS processed,
  coalesce(sum(service_fee) FILTER (WHERE status = 'success'), 0) AS fees
FROM electricity_transactions;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_elec_tx_reference ON electricity_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_elec_tx_bill_ref  ON electricity_transactions(bill_ref);

-- Meter → DISCO auto-detection cache (action:"detect" stores successful
-- lookups so repeat pastes are instant and don't re-scan all billers)
CREATE TABLE IF NOT EXISTS meter_disco_cache (
  meter_number text PRIMARY KEY,
  provider     text NOT NULL,
  meter_type   text NOT NULL DEFAULT 'prepaid',
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE meter_disco_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meter_cache_service_only" ON meter_disco_cache;
CREATE POLICY "meter_cache_service_only" ON meter_disco_cache
  USING (true) WITH CHECK (true); -- edge function uses service role key, bypasses RLS

-- Enable RLS
ALTER TABLE electricity_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "elec_tx_service_only" ON electricity_transactions;
CREATE POLICY "elec_tx_service_only" ON electricity_transactions
  USING (true) WITH CHECK (true); -- edge function uses service role key, bypasses RLS
