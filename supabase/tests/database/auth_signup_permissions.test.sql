BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(4);

SELECT ok(
  (
    SELECT procedure.prosecdef
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'enforce_disabled_tenant_final_state'
      AND pg_get_function_identity_arguments(procedure.oid) = ''
  ),
  'the deferred tenant check keeps its own definer permissions'
);

SELECT ok(
  (
    SELECT procedure.prosecdef
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'enforce_disabled_profile_final_state'
      AND pg_get_function_identity_arguments(procedure.oid) = ''
  ),
  'the deferred profile check keeps its own definer permissions'
);

SELECT is(
  (
    SELECT procedure.proconfig
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'enforce_disabled_tenant_final_state'
      AND pg_get_function_identity_arguments(procedure.oid) = ''
  ),
  ARRAY['search_path=public, pg_temp']::TEXT[],
  'the deferred tenant check uses a fixed safe search path'
);

SELECT is(
  (
    SELECT procedure.proconfig
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'enforce_disabled_profile_final_state'
      AND pg_get_function_identity_arguments(procedure.oid) = ''
  ),
  ARRAY['search_path=public, pg_temp']::TEXT[],
  'the deferred profile check uses a fixed safe search path'
);

SELECT * FROM finish();
ROLLBACK;
