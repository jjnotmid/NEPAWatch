-- ============================================================
-- NEPAWatch Phase 2: pg_cron schedule for server-side learning
-- Run in Supabase SQL Editor AFTER deploying the edge functions.
--
-- Prerequisites:
--   1. Run ai-infrastructure.sql first (Phase 1 tables)
--   2. Deploy: supabase functions deploy check-prediction-outcomes
--   3. Deploy: supabase functions deploy model-status
--   4. Deploy: supabase functions deploy compute-reliability
--   5. Enable pg_cron in Supabase: Dashboard → Database → Extensions → pg_cron
--   6. Enable pg_net in Supabase: Dashboard → Database → Extensions → pg_net
-- ============================================================

-- Replace YOUR_SUPABASE_PROJECT_REF with your actual project ref
-- (found in Supabase Dashboard → Settings → General)
-- Example: djurokbkkqrmpafcxlez

-- Hourly: check prediction outcomes and update accuracy weights
SELECT cron.schedule(
  'nepawatch-check-outcomes',
  '5 * * * *',   -- 5 minutes past every hour
  $$
  SELECT net.http_post(
    url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/check-prediction-outcomes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Daily at 02:00 UTC: recompute all area reliability scores
SELECT cron.schedule(
  'nepawatch-compute-reliability',
  '0 2 * * *',   -- 2 AM UTC daily
  $$
  SELECT net.http_post(
    url     := 'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/compute-reliability',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify cron jobs are registered
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'nepawatch-%';
