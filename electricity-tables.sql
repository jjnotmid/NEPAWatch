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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_elec_tx_reference ON electricity_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_elec_tx_bill_ref  ON electricity_transactions(bill_ref);

-- Enable RLS
ALTER TABLE electricity_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "elec_tx_service_only" ON electricity_transactions;
CREATE POLICY "elec_tx_service_only" ON electricity_transactions
  USING (true) WITH CHECK (true); -- edge function uses service role key, bypasses RLS
