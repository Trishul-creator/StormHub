-- Deferred constraint triggers run when the surrounding transaction commits.
-- At that point a Supabase Auth signup is executing as supabase_auth_admin,
-- rather than inside handle_new_user()'s SECURITY DEFINER context. These
-- integrity checks therefore need their own narrowly scoped definer context to
-- read the protected tenant/profile tables without granting Auth broad access.

BEGIN;

ALTER FUNCTION public.enforce_disabled_tenant_final_state()
  SECURITY DEFINER;
ALTER FUNCTION public.enforce_disabled_tenant_final_state()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.enforce_disabled_profile_final_state()
  SECURITY DEFINER;
ALTER FUNCTION public.enforce_disabled_profile_final_state()
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enforce_disabled_tenant_final_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_disabled_profile_final_state()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_disabled_tenant_final_state() IS
  'Deferred tenant offboarding invariant; SECURITY DEFINER is required because the check runs after the calling RPC context has ended.';
COMMENT ON FUNCTION public.enforce_disabled_profile_final_state() IS
  'Deferred profile offboarding invariant; SECURITY DEFINER lets Supabase Auth complete profile creation without receiving direct profile-table access.';

COMMIT;
