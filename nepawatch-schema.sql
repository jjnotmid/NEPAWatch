-- nepawatch-schema.sql
-- Run once in Supabase SQL Editor to add all missing columns and tables.
-- All statements are idempotent (safe to re-run).

-- ── profiles: gamification columns ──────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak  integer   DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak  integer   DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_report_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_reports   integer   DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges          text[]    DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count  integer   DEFAULT 0;

-- Unique index for referral_code (needed for upsert dedup and lookup)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_idx
  ON profiles (referral_code) WHERE referral_code IS NOT NULL;

-- Back-fill referral codes for users who signed up before this column existed
UPDATE profiles
SET referral_code = upper(substring(md5(id::text || COALESCE(email,'x')), 1, 6))
WHERE referral_code IS NULL;

-- Back-fill total_reports from actual report rows for established users
-- (safe: sets to 0 for users with no reports, never decrements)
UPDATE profiles p
SET total_reports = COALESCE((
  SELECT count(*) FROM reports r WHERE r.user_id = p.id
), 0)
WHERE p.total_reports IS NULL OR p.total_reports = 0;

-- ── push_subscriptions table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  area       text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_self"       ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_read"       ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_service"    ON push_subscriptions;

-- Users can manage only their own subscription row
CREATE POLICY "push_sub_self" ON push_subscriptions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Edge functions (service role) can read all for broadcasting
CREATE POLICY "push_sub_service" ON push_subscriptions
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- disco_alerts: admin-set per-DISCO AI prediction multipliers
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disco_alerts (
  id          bigserial   PRIMARY KEY,
  disco_code  text        NOT NULL UNIQUE,
  multiplier  numeric(4,2) NOT NULL DEFAULT 1.0,
  reason      text,
  active      boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE disco_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone can read (predict.js may want to fetch active multipliers from DB)
CREATE POLICY "disco_alerts_select" ON disco_alerts FOR SELECT USING (true);

-- Only authenticated admin writes; edge functions use service role key
CREATE POLICY "disco_alerts_write" ON disco_alerts FOR ALL
  USING (auth.email() = 'usifohjosh47@gmail.com')
  WITH CHECK (auth.email() = 'usifohjosh47@gmail.com');
