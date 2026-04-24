-- =====================================================================
-- NEPAWatch — Streak & Gamification Schema Migration
-- Run once in Supabase SQL Editor
-- =====================================================================

-- ── 1. Extend profiles table ──────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak   integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak   integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_report_date date,
  ADD COLUMN IF NOT EXISTS total_reports    integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badges           text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referral_code    text      UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by      text,
  ADD COLUMN IF NOT EXISTS referral_count   integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_reports   integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_rank      integer,
  ADD COLUMN IF NOT EXISTS weekly_champion_at timestamptz;

-- ── 2. Generate unique referral codes for existing users ─────────────
UPDATE profiles
SET referral_code = LOWER(
  SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)
)
WHERE referral_code IS NULL;

-- ── 3. Weekly leaderboard snapshot table ─────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_leaderboard (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start    date NOT NULL,               -- Monday of the week
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  report_count  integer DEFAULT 0,
  rank          integer,
  area          text,
  badges        text[] DEFAULT '{}',
  streak        integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_weekly_lb ON weekly_leaderboard(week_start, user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_lb_week ON weekly_leaderboard(week_start);

-- ── 4. Streak danger notification log (prevent duplicate 9pm nudges) ──
CREATE TABLE IF NOT EXISTS streak_nudges (
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  nudge_date date NOT NULL,
  PRIMARY KEY (user_id, nudge_date)
);

-- ── 5. View: current week leaderboard ────────────────────────────────
-- Called by renderCommunity() to show live rankings
CREATE OR REPLACE VIEW vw_weekly_leaders AS
WITH week_start AS (
  SELECT DATE_TRUNC('week', NOW() AT TIME ZONE 'Africa/Lagos')::date AS ws
),
report_counts AS (
  SELECT
    r.user_id,
    COUNT(*) AS report_count
  FROM reports r, week_start w
  WHERE r.created_at >= (w.ws::timestamptz AT TIME ZONE 'Africa/Lagos')
    AND r.user_id IS NOT NULL
    AND r.user_id != '00000000-0000-0000-0000-000000000001'::uuid
  GROUP BY r.user_id
)
SELECT
  p.id,
  p.name,
  p.location_area AS area,
  p.current_streak AS streak,
  p.badges,
  p.total_reports,
  p.longest_streak,
  COALESCE(rc.report_count, 0) AS weekly_count,
  RANK() OVER (ORDER BY COALESCE(rc.report_count, 0) DESC) AS rank
FROM profiles p
LEFT JOIN report_counts rc ON rc.user_id = p.id
WHERE COALESCE(rc.report_count, 0) > 0
ORDER BY weekly_count DESC;

-- ── 6. RLS: allow authenticated users to read leaderboard view ────────
-- (Views inherit table RLS — the profiles read policy already covers this)

-- ── 7. Allow users to read other profiles' public fields ─────────────
-- (Needed for leaderboard display — only exposes name, area, badges, streak)
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- Already had this? The following won't error if it exists:
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_own_insert" ON profiles;
CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
