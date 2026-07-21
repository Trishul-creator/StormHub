-- StormHub uses confirmed email plus role and school authorization for every account.
-- Keep this compatibility helper because the production hardening migration calls it
-- from existing policies, triggers, and RPCs. MFA assurance is no longer required.

CREATE OR REPLACE FUNCTION public.has_admin_mfa()
RETURNS BOOLEAN AS $$
  SELECT TRUE;
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

COMMENT ON FUNCTION public.has_admin_mfa() IS
  'Compatibility helper: email confirmation is the only account verification requirement.';
