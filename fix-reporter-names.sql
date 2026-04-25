-- =====================================================================
-- NEPAWatch — Fix names v6 (comprehensive — run in Supabase SQL Editor)
-- =====================================================================

-- STEP 1: Drop ALL existing RLS policies on profiles (clean slate)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END$$;

-- STEP 2: Ensure RLS is on, then create simple unambiguous policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or logged-in) can read any profile row
CREATE POLICY "profiles_read_all" ON public.profiles
  AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

-- Logged-in users can insert/update their own row
CREATE POLICY "profiles_own_write" ON public.profiles
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = id);

-- STEP 3: Backfill email + name on profiles that are missing them
UPDATE public.profiles p
SET
  email = COALESCE(p.email, u.email),
  name  = COALESCE(NULLIF(TRIM(p.name), ''), SPLIT_PART(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id
  AND (p.name IS NULL OR TRIM(p.name) = '' OR p.email IS NULL);

-- STEP 4: Create profile rows for users who have reports but no profile row
INSERT INTO public.profiles (id, email, name, notif_on)
SELECT DISTINCT
  r.user_id,
  u.email,
  SPLIT_PART(u.email, '@', 1),
  false
FROM reports r
JOIN auth.users u ON u.id = r.user_id
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE p.id IS NULL
  AND r.user_id IS NOT NULL
  AND r.user_id::text <> '00000000-0000-0000-0000-000000000001';

-- STEP 5: Recreate the SECURITY DEFINER function cleanly
DROP FUNCTION IF EXISTS public.get_reporter_names(uuid[]);

CREATE FUNCTION public.get_reporter_names(user_ids uuid[])
RETURNS TABLE(id uuid, first_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    au.id,
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(COALESCE(p.name, ''), ' ', 1)), ''),
      NULLIF(SPLIT_PART(au.email, '@', 1), ''),
      'User'
    ) AS first_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_reporter_names(uuid[]) TO anon, authenticated;

-- STEP 6: Verify — run these two lines to confirm it all works:
-- SELECT id, name, email FROM public.profiles LIMIT 10;
-- SELECT * FROM public.get_reporter_names(ARRAY(SELECT DISTINCT user_id FROM reports WHERE user_id IS NOT NULL LIMIT 5));
