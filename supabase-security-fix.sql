-- ============================================================
-- NEPAWatch — Security Hardening SQL
-- Run this ONCE in your Supabase SQL Editor:
--   https://supabase.com/dashboard/project/djurokbkkqrmpafcxlez/sql
-- ============================================================

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

-- ── 5. VERIFY ────────────────────────────────────────────────
-- These should all show your new policies:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'announcements';
