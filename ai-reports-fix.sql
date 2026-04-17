-- ai-reports-fix.sql
-- Run once in Supabase SQL Editor to fix AI report persistence.
--
-- Problem: reports.user_id is a UUID column but AI was inserting 'nepawatch-ai'
-- (an invalid UUID), causing every AI DB insert to fail silently.
--
-- Fix:
--   1. Drop the FK constraint that requires user_id to exist in auth.users
--      (AI has no auth account, so it can never satisfy this constraint)
--   2. Enable RLS and add a policy allowing the fixed AI UUID to insert without auth
--   3. Add ai_prob column if it doesn't already exist

-- ── Step 1: Drop FK on reports.user_id ────────────────────────────────────────
-- The AI inserts with a fixed UUID that has no matching auth.users row.
-- Human user reports still work fine — Supabase auth guarantees their UUID exists.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;

-- ── Step 2: Add ai_prob column (idempotent) ────────────────────────────────────
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_prob numeric(4,3);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wrong_votes integer DEFAULT 0;

-- ── Step 3: RLS policies ───────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all"           ON reports;
DROP POLICY IF EXISTS "reports_select"      ON reports;
DROP POLICY IF EXISTS "reports_insert"      ON reports;
DROP POLICY IF EXISTS "reports_insert_user" ON reports;
DROP POLICY IF EXISTS "reports_insert_ai"   ON reports;
DROP POLICY IF EXISTS "reports_update"      ON reports;
DROP POLICY IF EXISTS "reports_delete"      ON reports;

-- Anyone (including anonymous) can read reports
CREATE POLICY "reports_select" ON reports
  FOR SELECT USING (true);

-- Authenticated users can insert their own reports
CREATE POLICY "reports_insert_user" ON reports
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- AI system inserts using its fixed UUID — no auth session required
CREATE POLICY "reports_insert_ai" ON reports
  FOR INSERT WITH CHECK (
    user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Authenticated users can update reports (confirms, wrong_votes)
CREATE POLICY "reports_update" ON reports
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Users can delete their own reports; admin can delete any
CREATE POLICY "reports_delete" ON reports
  FOR DELETE USING (
    auth.uid() = user_id
    OR auth.email() = 'usifohjosh47@gmail.com'
  );
