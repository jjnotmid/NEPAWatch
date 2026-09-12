-- ============================================================
-- NEPAWatch Phase 1: AI Infrastructure Tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. ai_accuracy_weights
--    Persists per-area correction multipliers globally (was localStorage-only).
--    When the browser updates a multiplier the model writes here; on next session
--    it reads back from here — learning is permanent and cross-device.
CREATE TABLE IF NOT EXISTS ai_accuracy_weights (
  area           TEXT PRIMARY KEY,
  weight         NUMERIC(6,4)  NOT NULL DEFAULT 1.0,
  sample_count   INT           NOT NULL DEFAULT 0,
  last_updated   TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE ai_accuracy_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aiw_select" ON ai_accuracy_weights;
DROP POLICY IF EXISTS "aiw_insert" ON ai_accuracy_weights;
DROP POLICY IF EXISTS "aiw_update" ON ai_accuracy_weights;
CREATE POLICY "aiw_select" ON ai_accuracy_weights FOR SELECT USING (true);
CREATE POLICY "aiw_insert" ON ai_accuracy_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "aiw_update" ON ai_accuracy_weights FOR UPDATE USING (true);

-- 2. ai_predictions
--    Every AI prediction is logged here with its probability.
--    15 minutes after filing, the outcome is written back based on human votes.
--    This is the raw data that makes accuracy tracking possible.
CREATE TABLE IF NOT EXISTS ai_predictions (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id           TEXT,                                        -- reports.id after DB save
  area                TEXT          NOT NULL,
  disco               TEXT,
  type                TEXT          NOT NULL CHECK (type IN ('out','bck')),
  probability         NUMERIC(5,4)  NOT NULL,
  predicted_at        TIMESTAMPTZ   DEFAULT NOW(),
  -- Outcome filled ~15 min later by the browser feedback loop
  outcome             TEXT          CHECK (outcome IN ('correct','wrong','unresolved')),
  human_confirms      INT,
  human_wrong_votes   INT,
  outcome_checked_at  TIMESTAMPTZ
);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aip_select" ON ai_predictions;
DROP POLICY IF EXISTS "aip_insert" ON ai_predictions;
DROP POLICY IF EXISTS "aip_update" ON ai_predictions;
CREATE POLICY "aip_select" ON ai_predictions FOR SELECT USING (true);
CREATE POLICY "aip_insert" ON ai_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "aip_update" ON ai_predictions FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS aip_area_idx        ON ai_predictions (area);
CREATE INDEX IF NOT EXISTS aip_predicted_at_idx ON ai_predictions (predicted_at DESC);
CREATE INDEX IF NOT EXISTS aip_outcome_idx     ON ai_predictions (outcome) WHERE outcome IS NOT NULL;

-- 3. area_reliability
--    Computed summary per area: accuracy %, avg hours out/day, reliability score.
--    Written by the compute-reliability edge function (call it from admin or cron).
CREATE TABLE IF NOT EXISTS area_reliability (
  area                  TEXT          PRIMARY KEY,
  disco                 TEXT,
  total_predictions     INT           NOT NULL DEFAULT 0,
  correct_predictions   INT           NOT NULL DEFAULT 0,
  accuracy_pct          NUMERIC(5,2),
  avg_hours_out_per_day NUMERIC(5,2),
  reliability_score     NUMERIC(5,4)  NOT NULL DEFAULT 0.5,
  last_computed         TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE area_reliability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ar_select" ON area_reliability;
DROP POLICY IF EXISTS "ar_all" ON area_reliability;
CREATE POLICY "ar_select" ON area_reliability FOR SELECT USING (true);
CREATE POLICY "ar_all"    ON area_reliability FOR ALL   USING (true);
