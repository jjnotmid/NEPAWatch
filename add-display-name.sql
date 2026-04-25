-- =====================================================================
-- NEPAWatch — Add display_name to reports (run once in SQL Editor)
-- This is the permanent fix for names showing as "Reporter"
-- =====================================================================

-- 1. Add the column (safe to run if it already exists)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Backfill existing reports from profiles + auth.users fallback
UPDATE public.reports r
SET display_name = SPLIT_PART(
  COALESCE(
    NULLIF(TRIM(p.name), ''),
    u.email,
    ''
  ), ' ', 1
)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE r.user_id = u.id
  AND r.display_name IS NULL
  AND r.user_id IS NOT NULL
  AND r.user_id::text <> '00000000-0000-0000-0000-000000000001';

-- 3. Verify backfill worked:
-- SELECT user_id, display_name, COUNT(*) FROM reports
-- WHERE display_name IS NOT NULL
-- GROUP BY user_id, display_name
-- ORDER BY COUNT(*) DESC LIMIT 20;
