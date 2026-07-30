-- Keep school selectors complete beyond PostgREST's default row cap while
-- limiting each anonymous signup-directory response to a bounded page.

BEGIN;

DROP FUNCTION IF EXISTS public.list_signup_schools();
CREATE FUNCTION public.list_signup_schools(
  page_offset INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 100,
  search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_name TEXT,
  slug TEXT,
  logo_url TEXT,
  mascot TEXT
) AS $$
  SELECT
    school.id,
    school.name,
    school.short_name,
    school.slug,
    school.logo_url,
    school.mascot
  FROM public.schools school
  WHERE school.is_active = TRUE
    AND school.is_public = TRUE
    AND (
      NULLIF(BTRIM(COALESCE(search_text, '')), '') IS NULL
      OR LOWER(CONCAT_WS(' ', school.name, school.short_name, school.slug))
        LIKE '%' || LOWER(BTRIM(search_text)) || '%'
    )
  ORDER BY school.name, school.id
  LIMIT LEAST(GREATEST(COALESCE(page_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(page_offset, 0), 0);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.list_signup_schools(INTEGER, INTEGER, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signup_schools(INTEGER, INTEGER, TEXT)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.list_signup_schools(INTEGER, INTEGER, TEXT) IS
  'Bounded public signup directory page containing only non-sensitive active-school fields.';

COMMIT;
