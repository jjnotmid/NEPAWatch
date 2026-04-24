-- =====================================================================
-- NEPAWatch — Fix "Reporter" showing instead of real names
-- Run once in Supabase SQL Editor
-- =====================================================================

-- 1. Ensure RLS is on and the public read policy exists
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "public_read_profile_names" ON profiles;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- 2. SECURITY DEFINER function — bypasses RLS completely
--    The anon key can call this and always get names back.
CREATE OR REPLACE FUNCTION public.get_reporter_names(user_ids uuid[])
RETURNS TABLE(id uuid, first_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(p.name, ' ', 1)), ''),
      NULLIF(SPLIT_PART(p.email, '@', 1), ''),
      'Reporter'
    ) AS first_name
  FROM profiles p
  WHERE p.id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_reporter_names TO anon, authenticated;
