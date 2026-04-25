-- =====================================================================
-- NEPAWatch — Fix "Reporter" showing instead of real names (v4)
-- Run once in Supabase SQL Editor
-- =====================================================================

-- 1. Backfill email on profiles that are missing it
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR TRIM(p.email) = '');

-- 2. Backfill name on profiles that have no name (use email username as fallback)
UPDATE profiles p
SET name = SPLIT_PART(COALESCE(p.email, u.email, ''), '@', 1)
FROM auth.users u
WHERE p.id = u.id
  AND (p.name IS NULL OR TRIM(p.name) = '');

-- 3. Create profile rows for users who submitted reports but have NO profile row at all
INSERT INTO profiles (id, email, name, notif_on)
SELECT DISTINCT
  r.user_id,
  u.email,
  SPLIT_PART(COALESCE(u.email, ''), '@', 1),
  false
FROM reports r
JOIN auth.users u ON u.id = r.user_id
LEFT JOIN profiles p ON p.id = r.user_id
WHERE p.id IS NULL
  AND r.user_id IS NOT NULL
  AND r.user_id::text <> '00000000-0000-0000-0000-000000000001';

-- 4. Ensure public read policy on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "public_read_profile_names" ON profiles;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- 5. Keep the SECURITY DEFINER function for ongoing use (new signups)
CREATE OR REPLACE FUNCTION public.get_reporter_names(user_ids uuid[])
RETURNS TABLE(id uuid, first_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    au.id,
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(COALESCE(p.name, ''), ' ', 1)), ''),
      NULLIF(SPLIT_PART(COALESCE(p.email, au.email, ''), '@', 1), ''),
      'Anon'
    ) AS first_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_reporter_names TO anon, authenticated;

-- 6. Quick verification — run this to see what names will show:
-- SELECT id, name, email FROM profiles ORDER BY created_at DESC LIMIT 20;
