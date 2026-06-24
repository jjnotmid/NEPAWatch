/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — AI Engine Schema (Phase 4: Server-Side AI)
   Run this in Supabase SQL Editor AFTER:
     - ai-infrastructure.sql (Phase 1)
     - phase3-tables.sql (Phase 3 — nerc_baselines, weather_log)
   Requires: pg_cron + pg_net extensions enabled in Supabase Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── area_predictions ───────────────────────────────────────────────────
   Server-precomputed probabilities per area.
   Written by ai-engine edge function every 10 min.
   Read by browser (~200 areas × ~200 bytes ≈ 40 KB — replaces 10 000-row download).
   ─────────────────────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS area_predictions (
  area              TEXT PRIMARY KEY,
  disco             TEXT,
  band              TEXT,
  current_prob      NUMERIC(5,4),
  forecast_24h      JSONB,         -- [{hour, prob}, ...] next 24 hours
  ai_status         TEXT,          -- 'out' | 'bck' | null
  last_ai_out_at    TIMESTAMPTZ,   -- when AI last filed an 'out' report
  last_ai_report_id TEXT,          -- id of the last AI-filed report for this area
  computed_at       TIMESTAMPTZ DEFAULT NOW()
);

/* Public read-only — service role for writes */
ALTER TABLE area_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "area_predictions_public_read" ON area_predictions;
CREATE POLICY "area_predictions_public_read"
  ON area_predictions FOR SELECT TO anon, authenticated USING (true);

/* Index for fast lookup by disco */
CREATE INDEX IF NOT EXISTS idx_area_predictions_disco ON area_predictions (disco);

/* ─── pg_cron: run ai-engine every 10 minutes ────────────────────────────
   PREREQUISITES:
     1. Enable pg_cron:  Dashboard → Database → Extensions → pg_cron
     2. Enable pg_net:   Dashboard → Database → Extensions → pg_net
     3. Replace YOUR_SERVICE_ROLE_KEY below with the actual key
        (Settings → API → service_role secret)
   ─────────────────────────────────────────────────────────────────────── */
SELECT cron.schedule(
  'ai-engine-10min',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/ai-engine',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

/* Verify the cron job was created */
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname IN ('ai-engine-10min');
