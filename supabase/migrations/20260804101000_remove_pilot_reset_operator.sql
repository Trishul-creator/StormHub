-- The one-time production pilot reset has been verified. Remove its operator
-- entry point so the destructive capability does not remain callable.

BEGIN;

REVOKE ALL ON FUNCTION public.reset_platform_for_pilot(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.reset_platform_for_pilot(TEXT);

COMMIT;
