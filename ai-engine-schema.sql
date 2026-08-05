/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — AI Engine setup

   Run this whole file in the Supabase SQL Editor.
   Prerequisites:
     1. Dashboard → Database → Extensions → enable  pg_cron
     2. Dashboard → Database → Extensions → enable  pg_net
     3. supabase functions deploy ai-engine
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── 1. area_predictions ────────────────────────────────────────────────
   Server-precomputed probability per area. Written by the ai-engine every
   10 minutes, read by the browser instead of a 10 000-row training download. */
CREATE TABLE IF NOT EXISTS area_predictions (
  area              TEXT PRIMARY KEY,
  disco             TEXT,
  band              TEXT,
  current_prob      NUMERIC(5,4),
  forecast_24h      JSONB,         -- [{hour, prob}, ...] next 24 hours
  ai_status         TEXT,          -- 'out' | 'bck' | null
  last_ai_out_at    TIMESTAMPTZ,
  last_ai_report_id TEXT,
  computed_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE area_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "area_predictions_public_read" ON area_predictions;
CREATE POLICY "area_predictions_public_read"
  ON area_predictions FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_area_predictions_disco ON area_predictions (disco);

/* ─── 2. Store the service role key in Vault ─────────────────────────────
   Replace the placeholder with Settings → API → service_role, then run.
   Keeping it here rather than inline in the cron command means the key is
   encrypted at rest instead of sitting in cron.job in clear text.         */
DELETE FROM vault.secrets WHERE name = 'service_role_key';
SELECT vault.create_secret(
  'PASTE_YOUR_SERVICE_ROLE_KEY_HERE',
  'service_role_key',
  'Used by pg_cron to authenticate calls to the ai-engine function'
);

/* ─── 3. Schedule the engine every 10 minutes ────────────────────────── */
SELECT cron.unschedule('ai-engine-10min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-engine-10min');

SELECT cron.schedule(
  'ai-engine-10min',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/ai-engine',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )
      ),
      body    := '{}'::jsonb
    );
  $$
);


/* ═══════════════════════════════════════════════════════════════════════════
   VERIFICATION — run these after the steps above
   ═══════════════════════════════════════════════════════════════════════════ */

-- A. Is the cron job registered?
--    Expect exactly one row.
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'ai-engine-10min';

-- B. Has it actually run, and did the HTTP call succeed?
--    status should be 'succeeded'. If it is 'failed', the message column says why.
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ai-engine-10min')
ORDER BY start_time DESC
LIMIT 5;

-- C. Did the engine write predictions?
--    Expect ~291 rows and a computed_at within the last 10 minutes.
SELECT count(*) AS areas, max(computed_at) AS last_run FROM area_predictions;

-- D. Is the AI filing reports?
--    Expect a growing count once the engine has run a few times.
SELECT count(*) AS ai_reports_24h, max(created_at) AS most_recent
FROM reports
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND created_at > now() - interval '24 hours';

-- E. How much human history does the model have to learn from?
--    The engine trains on human reports only. If this is very low, most areas
--    fall back to the stricter bootstrap path (higher threshold, 3 h cooldown).
SELECT count(*) AS human_reports_7d
FROM reports
WHERE user_id <> '00000000-0000-0000-0000-000000000001'
  AND created_at > now() - interval '7 days';

-- F. Are any areas stuck 'out'?
--    An area held at 'out' cannot fire a new outage report. If this number is
--    large and not falling, restorations are not triggering.
SELECT count(*) FILTER (WHERE ai_status = 'out') AS stuck_out,
       count(*) FILTER (WHERE ai_status = 'bck') AS restored,
       count(*) FILTER (WHERE ai_status IS NULL) AS never_fired
FROM area_predictions;

-- Reset every area to a clean state if F shows a stuck backlog:
-- UPDATE area_predictions SET ai_status = NULL, last_ai_out_at = NULL;
