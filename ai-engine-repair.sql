/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — AI Engine repair (one-shot, idempotent, safe to re-run)

   Why AI reports weren't showing/sending — run this to find & fix:
     1. pg_cron / pg_net extensions not enabled
     2. reports.user_id FK rejected the AI's fixed UUID (inserts failed silently)
     3. the cron job uses a placeholder service key (every call 401s)
     4. the ai-engine function never deployed
     5. area_predictions / ai_predictions / weather_log tables missing

   HOW TO RUN:
     1. Dashboard → Database → Extensions → enable  pg_cron  and  pg_net
     2. Run THIS FILE in the SQL Editor
     3. Scroll to "STEP 6" below, replace 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'
        with Settings → API → service_role, then run STEP 6 only.
     4. Deploy the engine:  supabase functions deploy ai-engine
     5. Re-run the DIAGNOSTICS block at the bottom.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── STEP 1: extensions (requires owner; run via dashboard Extensions if this errors) */
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

/* ─── STEP 2: tables the engine writes to ────────────────────────────────── */
CREATE TABLE IF NOT EXISTS area_predictions (
  area              TEXT PRIMARY KEY,
  disco             TEXT,
  band              TEXT,
  current_prob      NUMERIC(5,4),
  forecast_24h      JSONB,
  ai_status         TEXT,
  last_ai_out_at    TIMESTAMPTZ,
  last_ai_report_id TEXT,
  computed_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE area_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "area_predictions_public_read" ON area_predictions;
CREATE POLICY "area_predictions_public_read"
  ON area_predictions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ai_predictions (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id         TEXT,
  area              TEXT          NOT NULL,
  disco             TEXT,
  type              TEXT          NOT NULL CHECK (type IN ('out','bck')),
  probability       NUMERIC(5,4)  NOT NULL,
  predicted_at      TIMESTAMPTZ   DEFAULT NOW(),
  outcome           TEXT,
  human_confirms    INT,
  human_wrong_votes INT,
  outcome_checked_at TIMESTAMPTZ
);
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aip_select" ON ai_predictions;
CREATE POLICY "aip_select" ON ai_predictions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS weather_log (
  id           BIGSERIAL PRIMARY KEY,
  lat_key      NUMERIC(4,1) NOT NULL,
  lon_key      NUMERIC(4,1) NOT NULL,
  logged_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  weather_code INT,
  rain_mm      NUMERIC(6,3) NOT NULL DEFAULT 0,
  wind_kmh     NUMERIC(5,2) NOT NULL DEFAULT 0
);

/* These two are read by the engine on EVERY run — if they are missing the
   whole run crashes before writing anything, which shows up as an empty
   AI Intelligence page even though the function "runs". */
CREATE TABLE IF NOT EXISTS ai_accuracy_weights (
  area         TEXT PRIMARY KEY,
  weight       NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  sample_count INT           NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ   DEFAULT NOW()
);
ALTER TABLE ai_accuracy_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aiw_select" ON ai_accuracy_weights;
DROP POLICY IF EXISTS "aiw_insert" ON ai_accuracy_weights;
DROP POLICY IF EXISTS "aiw_update" ON ai_accuracy_weights;
CREATE POLICY "aiw_select" ON ai_accuracy_weights FOR SELECT USING (true);
CREATE POLICY "aiw_insert" ON ai_accuracy_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "aiw_update" ON ai_accuracy_weights FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS nerc_baselines (
  disco         TEXT NOT NULL,
  band          TEXT NOT NULL,
  outage_prob   NUMERIC(5,4) NOT NULL,
  supply_hours  NUMERIC(4,1) NOT NULL,
  saidi_annual  NUMERIC(8,2),
  saifi_annual  NUMERIC(6,2),
  source_period TEXT DEFAULT 'predict.js defaults',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nerc_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nerc_select" ON nerc_baselines;
CREATE POLICY "nerc_select" ON nerc_baselines FOR SELECT USING (true);

/* ─── STEP 3: let the AI write reports (the silent-FK-failure fix) ───────── */
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_prob numeric(4,3);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wrong_votes integer DEFAULT 0;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

INSERT INTO profiles (id, email, name, notif_on)
VALUES ('00000000-0000-0000-0000-000000000001', 'ai@nepawatch.app', 'NEPAWatch AI', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert_ai"   ON reports;
DROP POLICY IF EXISTS "reports_select"      ON reports;
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_insert_ai" ON reports FOR INSERT WITH CHECK (
  user_id = '00000000-0000-0000-0000-000000000001'::uuid
);

/* ─── STEP 4: reschedule the engine cron (correct URL, vault-held key) ───── */
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

SELECT cron.unschedule('nepawatch-compute-reliability')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nepawatch-compute-reliability');
SELECT cron.schedule(
  'nepawatch-compute-reliability',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/compute-reliability',
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

/* ─── STEP 5: repair the Phase-2 cron jobs (they had a placeholder key) ──── */
SELECT cron.unschedule('nepawatch-check-outcomes')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nepawatch-check-outcomes');
SELECT cron.schedule(
  'nepawatch-check-outcomes',
  '5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/check-prediction-outcomes',
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

/* ─── STEP 6: store the real service role key in Vault ─────────────────────
   ⚠ Use the NEW-format secret key: Settings → API → "Secret API keys" →
     the key starting with sb_secret_ (NOT the deprecated legacy eyJ... JWT —
     the gateway rejects legacy JWTs now that the project uses JWT Signing
     Keys). Replace the placeholder, then run THIS STEP ALONE.        */
-- DELETE FROM vault.secrets WHERE name = 'service_role_key';
-- SELECT vault.create_secret('PASTE_YOUR_SERVICE_ROLE_KEY_HERE', 'service_role_key', 'Used by pg_cron to authenticate calls to the ai-engine function');

/* ─── STEP 6b: the FUNCTION'S OWN secret must be the SAME key ───────────────
   A 401 in the ai-engine logs means the key pg_cron sends (Vault) differs
   from the key the function compares against (its env secret).
   Fix in the dashboard — no SQL needed:
     Settings → Edge Functions → Secrets →
     make sure SUPABASE_SERVICE_ROLE_KEY exists and equals the CURRENT
     service_role key, then re-run STEP 6 with that same key so both match. */

/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNOSTICS — run after the steps above and interpret each result:
   ═══════════════════════════════════════════════════════════════════════════ */

-- A. Cron job registered?  → expect exactly 1 row, active = true
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'nepawatch-%' OR jobname = 'ai-engine-10min';

-- B. Did it actually run, and did the HTTP call succeed?
--    status must be 'succeeded'. 'failed' + return_message shows why
--    (e.g. "401" = wrong/missing Vault key, "404" = function not deployed,
--     "connection refused" = pg_net missing).
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
JOIN cron.job USING (jobid)
WHERE jobname IN ('ai-engine-10min','nepawatch-check-outcomes')
ORDER BY start_time DESC
LIMIT 8;

-- C. Did the engine write predictions? → expect ~291 rows, computed_at recent
SELECT count(*) AS areas, max(computed_at) AS last_run FROM area_predictions;

-- D. Is the AI filing reports? → count should grow every ~10 min
SELECT count(*) AS ai_reports_24h, max(created_at) AS most_recent
FROM reports
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND created_at > now() - interval '24 hours';

-- E. Human training history → if tiny, the engine mostly stays on the
--    stricter bootstrap path (higher threshold, 3h cooldown) — expected
--    at low traffic.
SELECT count(*) AS human_reports_7d
FROM reports
WHERE user_id <> '00000000-0000-0000-0000-000000000001'
  AND created_at > now() - interval '7 days';

-- F. Stuck states → large stuck_out that never falls = restorations not
--    firing (usually means B shows failures, or human history is empty).
SELECT count(*) FILTER (WHERE ai_status = 'out') AS stuck_out,
       count(*) FILTER (WHERE ai_status = 'bck') AS restored,
       count(*) FILTER (WHERE ai_status IS NULL) AS never_fired
FROM area_predictions;

-- G. Reset to a clean state if F shows a big stuck backlog:
-- UPDATE area_predictions SET ai_status = NULL, last_ai_out_at = NULL;

-- H. Are the OTHER functions (send-push etc.) reachable? Quick smoke:
--    curl https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/ai-engine -H "Authorization: Bearer <service_role>"
--    → a JSON body with run_at / out / bck means the engine works.

/* ─── Push notifications (the "send" part) ──────────────────────────────────
   Reports appearing in the feed = engine fixed (A–D green).
   Reports PUSHING to subscribed users additionally needs:
     1. supabase functions deploy send-push
     2. Secrets set on send-push: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
        VAPID_SUBJECT (must match the VAPID_PUBLIC_KEY in app.js)
     Without these the engine still files reports, but nobody gets pushed. */

/* ═══════════════════════════════════════════════════════════════════════════
   I. FIRE THE ENGINE RIGHT NOW (manual test)
   Run this single statement — it calls the function immediately and prints
   the HTTP status. Then check Supabase → Edge Functions → ai-engine → Logs:
   the run log now prints "OUT insert FAILED …" if the DB rejected the
   report, plus training rows, candidates, rejected reasons, out/bck counts.
   ═══════════════════════════════════════════════════════════════════════════ */
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
) AS request_id;

/* Or from your terminal (replace the key):
   curl -X POST https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/ai-engine \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <service_role_key>" \
     -d '{}'

   Expected reply: JSON with run_at, training_rows, candidates, out, bck,
   rejected and log — NOT a 401/404. 401 = Vault key missing/wrong,
   404 = function not deployed, "out: 0, bck: 0" with all candidates
   rejected = engine healthy but below thresholds (normal at low traffic —
   human reports feed it, and every human report is stored regardless). */
