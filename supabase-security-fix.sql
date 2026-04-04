-- ============================================================
-- NEPAWatch — Security Hardening SQL
-- Run this ONCE in your Supabase SQL Editor:
--   https://supabase.com/dashboard/project/djurokbkkqrmpafcxlez/sql
-- ============================================================

-- ── 0. ADD MISSING COLUMNS TO reports TABLE ──────────────────
-- The AI reporter tries to save ai_prob to the reports table.
-- Without these columns every AI report INSERT returns 400.
-- Run this section FIRST — everything else depends on it.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ai_prob     FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wrong_votes INTEGER DEFAULT 0;

-- Index so queries filtering by AI reports stay fast
CREATE INDEX IF NOT EXISTS idx_reports_ai_prob ON reports (ai_prob) WHERE ai_prob IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_wrong_votes ON reports (wrong_votes) WHERE wrong_votes > 0;

-- ── 1. FIND & DELETE THE MALICIOUS ANNOUNCEMENT ─────────────
-- Review it first (uncomment next line to preview):
-- SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10;

-- Delete the hacker's message (inserted around 2026-04-04 01:00 WAT):
DELETE FROM announcements
WHERE message ILIKE '%vibe%coding%'
   OR message ILIKE '%security%son%'
   OR message ILIKE '%dear developer%';

-- ── 2. LOCK DOWN announcements WITH RLS ──────────────────────
-- The table had NO write restrictions — any anon user with your
-- public key could INSERT via the REST API. This fixes that.

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop any old permissive policies first
DROP POLICY IF EXISTS "allow_all" ON announcements;
DROP POLICY IF EXISTS "announcements_select" ON announcements;
DROP POLICY IF EXISTS "announcements_insert" ON announcements;
DROP POLICY IF EXISTS "announcements_update" ON announcements;
DROP POLICY IF EXISTS "announcements_delete" ON announcements;

-- Anyone (including logged-out users) can READ announcements
CREATE POLICY "announcements_select"
  ON announcements FOR SELECT
  USING (true);

-- ONLY your admin email(s) can INSERT / UPDATE / DELETE
-- Replace the email below with your actual admin email address
CREATE POLICY "announcements_insert"
  ON announcements FOR INSERT
  WITH CHECK (
    auth.email() IN (
      'usifohjosh47@gmail.com'   -- ← REPLACE THIS
    )
  );

CREATE POLICY "announcements_update"
  ON announcements FOR UPDATE
  USING (
    auth.email() IN (
      'usifohjosh47@gmail.com'   -- ← REPLACE THIS
    )
  );

CREATE POLICY "announcements_delete"
  ON announcements FOR DELETE
  USING (
    auth.email() IN (
      'usifohjosh47@gmail.com'   -- ← REPLACE THIS
    )
  );

-- ── 3. ADD AUDIT COLUMN (who created each announcement) ──────
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Auto-stamp creator email on every insert going forward
CREATE OR REPLACE FUNCTION stamp_announcement_author()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.email();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stamp_announcement ON announcements;
CREATE TRIGGER trg_stamp_announcement
  BEFORE INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION stamp_announcement_author();

-- ── 4. SEE WHO DID IT ────────────────────────────────────────
-- After applying the audit column above, check the existing row:
SELECT id, area, message, scheduled_for, created_by, created_at
FROM announcements
ORDER BY created_at DESC
LIMIT 20;

-- For the existing malicious row the created_by will be NULL (inserted
-- before the audit trigger), but you can cross-reference the exact
-- timestamp against your Supabase API logs here:
--   Dashboard → Logs → API Logs → filter by table=announcements & method=POST

-- ── 5. LOCK DOWN email_alert_log WITH RLS ───────────────────
-- Supabase Advisor flagged this table as public with no RLS.
-- This table logs every email alert sent — it should NEVER be
-- readable or writable by anonymous users.

ALTER TABLE email_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all"          ON email_alert_log;
DROP POLICY IF EXISTS "email_log_select"   ON email_alert_log;
DROP POLICY IF EXISTS "email_log_insert"   ON email_alert_log;
DROP POLICY IF EXISTS "email_log_delete"   ON email_alert_log;

-- Only the service role (edge functions) can INSERT log entries.
-- No anon / authenticated user should read or write this table directly.
-- The service role bypasses RLS entirely, so edge functions still work.
-- Authenticated admin can SELECT for auditing purposes only.
CREATE POLICY "email_log_select"
  ON email_alert_log FOR SELECT
  USING (
    auth.email() IN (
      'usifohjosh47@gmail.com'   -- ← REPLACE THIS (same as above)
    )
  );

-- Block all direct INSERT/UPDATE/DELETE from the client (edge fn uses service role)
-- No INSERT policy = only service role can insert. This is intentional.

-- ── 6. SCAN FOR OTHER UNPROTECTED TABLES ─────────────────────
-- Run this to find any other public tables missing RLS:
SELECT relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = c.relname
  )
ORDER BY relname;
-- Any table listed here has NO RLS policies. Review each one carefully.

-- ── 7. VERIFY ALL POLICIES ───────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('announcements', 'email_alert_log')
ORDER BY tablename, cmd;
