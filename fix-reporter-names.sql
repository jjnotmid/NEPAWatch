-- =====================================================================
-- NEPAWatch — Fix "Reporter" names (v5 — run this in Supabase SQL Editor)
-- =====================================================================

-- Step 1: Drop and recreate the SECURITY DEFINER function cleanly
-- This function runs as the postgres user so it bypasses RLS entirely
-- and can read auth.users (which the anon/authenticated roles cannot).

DROP FUNCTION IF EXISTS public.get_reporter_names(uuid[]);

CREATE OR REPLACE FUNCTION public.get_reporter_names(user_ids uuid[])
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

-- Step 2: Verify it works — run this immediately after:
-- SELECT * FROM public.get_reporter_names(
--   ARRAY(SELECT DISTINCT user_id FROM reports WHERE user_id IS NOT NULL LIMIT 5)
-- );
-- You should see real names / email usernames, NOT 'User' or 'Reporter'.

-- Step 3: Backfill profile names so the regular profiles table also has them
-- (belt-and-suspenders — the function above is the real fix)
UPDATE public.profiles p
SET
  email = COALESCE(p.email, u.email),
  name  = COALESCE(
            NULLIF(TRIM(p.name), ''),
            SPLIT_PART(u.email, '@', 1)
          )
FROM auth.users u
WHERE p.id = u.id
  AND (p.name IS NULL OR TRIM(p.name) = '');

-- Step 4: Create profile rows for report-submitters with no profile at all
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
