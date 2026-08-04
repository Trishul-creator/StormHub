-- Hosted Supabase enables safe-update checks that require explicit predicates
-- on every DELETE. Patch the already-deployed short-lived reset function while
-- keeping fresh database rebuilds equivalent to its corrected source migration.

BEGIN;

DO $migration$
DECLARE
  function_definition TEXT;
  safe_function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.reset_platform_for_pilot(text)'::REGPROCEDURE
  ) INTO function_definition;

  safe_function_definition := regexp_replace(
    function_definition,
    'DELETE FROM ([a-zA-Z0-9_.]+);',
    'DELETE FROM \1 WHERE TRUE;',
    'g'
  );

  IF safe_function_definition IS DISTINCT FROM function_definition THEN
    EXECUTE safe_function_definition;
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.reset_platform_for_pilot(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_platform_for_pilot(TEXT)
  TO service_role;

COMMIT;
