-- =====================================================================
-- NEPAWatch — Fix "Reporter" showing instead of real names (v3)
-- Run once in Supabase SQL Editor
-- =====================================================================

-- 1. Ensure public read policy on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "public_read_profile_names" ON profiles;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- 2. SECURITY DEFINER function that joins auth.users as fallback
--    auth.users always has the email even when profiles row is missing/empty.
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
      'Reporter'
    ) AS first_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_reporter_names TO anon, authenticated;
