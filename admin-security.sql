/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — Admin access hardening

   Replaces every hardcoded admin email with a database-backed allowlist.
   Before this, the admin address was readable in the frontend bundle and
   repeated across RLS policies, so adding or removing an admin meant editing
   and redeploying code.

   Run once in the Supabase SQL Editor.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── 1. Admin allowlist ─────────────────────────────────────────────────
   Keyed on auth user id, not email, so changing an email cannot silently
   grant or revoke access. */
CREATE TABLE IF NOT EXISTS admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

/* No policies are defined, so under RLS the table is unreadable to anon and
   authenticated clients. Only the service role and the SECURITY DEFINER
   function below can see it. Nobody can enumerate who the admins are. */

/* ─── 2. Seed yourself ───────────────────────────────────────────────────
   Uses your existing auth account. Change the address here only — it never
   reaches the frontend. */
INSERT INTO admins (user_id, note)
SELECT id, 'founder'
FROM auth.users
WHERE lower(email) = lower('usifohjosh47@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

/* ─── 3. is_admin() ──────────────────────────────────────────────────────
   SECURITY DEFINER so it can read the admins table while the caller cannot.
   Returns a bare boolean — it never discloses which account is privileged. */
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

/* An anonymous visitor cannot call it at all; a signed-in non-admin gets
   false. Either way the admin identity stays server-side. */


/* ─── 4. Repoint RLS policies at is_admin() ──────────────────────────────
   These previously compared auth.email() to a literal address. */

-- disco_alerts (nepawatch-schema.sql)
DROP POLICY IF EXISTS "disco_alerts_write" ON disco_alerts;
CREATE POLICY "disco_alerts_write" ON disco_alerts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- api_keys: admins manage keys; the public insert policy stays as-is so the
-- self-serve signup form keeps working.
DROP POLICY IF EXISTS "api_keys_admin_all" ON api_keys;
CREATE POLICY "api_keys_admin_all" ON api_keys FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- api_logs: admin read only.
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_logs_admin_read" ON api_logs;
CREATE POLICY "api_logs_admin_read" ON api_logs FOR SELECT
  USING (public.is_admin());

-- reports: a user may delete their own, an admin may delete any
-- (ai-reports-fix.sql previously compared auth.email() to a literal address).
DROP POLICY IF EXISTS "reports_delete" ON reports;
CREATE POLICY "reports_delete" ON reports FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());


/* ═══════════════════════════════════════════════════════════════════════════
   VERIFICATION
   ═══════════════════════════════════════════════════════════════════════════ */

-- A. Is exactly one admin registered, and is it the right account?
SELECT a.user_id, u.email, a.note
FROM admins a JOIN auth.users u ON u.id = a.user_id;

-- B. Signed in as yourself in the SQL editor this returns true.
--    From an anon client the call is rejected outright.
SELECT public.is_admin() AS am_i_admin;

-- C. Confirm no policy still hardcodes an email address.
--    Expect zero rows.
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%@%' OR with_check LIKE '%@%');


/* ─── Adding another admin later ─────────────────────────────────────────
INSERT INTO admins (user_id, note)
SELECT id, 'ops team' FROM auth.users WHERE lower(email) = lower('them@example.com');

   ─── Revoking ───────────────────────────────────────────────────────────
DELETE FROM admins
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('them@example.com'));
*/
