-- Return a complete, paginated user inventory without relying on PostgREST's
-- default row cap. Scope is enforced inside the database so platform,
-- district, and school administrators cannot cross their permitted boundary.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_admin_profile(
  target_school_id UUID,
  target_district_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (
          actor.role = 'admin'
          AND actor.school_id IS NOT NULL
          AND actor.school_id = target_school_id
        )
        OR (
          actor.role = 'district_admin'
          AND actor.district_id IS NOT NULL
          AND actor.district_id = target_district_id
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_read_admin_profile(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_admin_profile(UUID, UUID)
  TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.can_read_admin_profile(school_id, district_id)
  );

DROP FUNCTION IF EXISTS public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
);

CREATE FUNCTION public.get_admin_user_inventory(
  requested_page INTEGER DEFAULT 1,
  requested_page_size INTEGER DEFAULT 50,
  search_text TEXT DEFAULT NULL,
  requested_school_id UUID DEFAULT NULL,
  requested_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  school_id UUID,
  district_id UUID,
  full_name TEXT,
  email TEXT,
  grade_level INTEGER,
  avatar_url TEXT,
  user_role TEXT,
  account_status TEXT,
  graduation_year INTEGER,
  onboarding_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  school_name TEXT,
  district_name TEXT,
  club_assignments JSONB,
  total_count BIGINT
) AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  normalized_page INTEGER := GREATEST(COALESCE(requested_page, 1), 1);
  normalized_page_size INTEGER := LEAST(GREATEST(COALESCE(requested_page_size, 50), 1), 100);
  normalized_search TEXT := NULLIF(LOWER(BTRIM(COALESCE(search_text, ''))), '');
  normalized_role TEXT := NULLIF(LOWER(BTRIM(COALESCE(requested_role, ''))), '');
  selected_school public.schools%ROWTYPE;
BEGIN
  SELECT *
  INTO actor
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor.id IS NULL
    OR actor.account_status IS DISTINCT FROM 'active'
    OR actor.role NOT IN ('admin', 'district_admin', 'super_admin')
  THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF normalized_role IS NOT NULL
    AND normalized_role NOT IN ('student', 'teacher', 'admin', 'district_admin', 'super_admin')
  THEN
    RAISE EXCEPTION 'Invalid role filter';
  END IF;

  IF requested_school_id IS NOT NULL THEN
    SELECT *
    INTO selected_school
    FROM public.schools
    WHERE id = requested_school_id;

    IF selected_school.id IS NULL THEN
      RAISE EXCEPTION 'School not found';
    END IF;
    IF actor.role = 'admin'
      AND actor.school_id IS DISTINCT FROM selected_school.id
    THEN
      RAISE EXCEPTION 'Administrator access required for this school';
    END IF;
    IF actor.role = 'district_admin'
      AND (
        actor.district_id IS NULL
        OR actor.district_id IS DISTINCT FROM selected_school.district_id
      )
    THEN
      RAISE EXCEPTION 'Administrator access required for this school';
    END IF;
  END IF;

  RETURN QUERY
  WITH scoped_users AS (
    SELECT
      target.id,
      target.school_id,
      target.district_id,
      target.full_name,
      target.email,
      target.grade_level,
      target.avatar_url,
      target.role,
      target.account_status,
      target.graduation_year,
      target.onboarding_reset_at,
      target.created_at,
      target.updated_at,
      school.name AS school_name,
      district.name AS district_name
    FROM public.profiles target
    LEFT JOIN public.schools school ON school.id = target.school_id
    LEFT JOIN public.districts district ON district.id = target.district_id
    WHERE (
      actor.role = 'super_admin'
      OR (
        actor.role = 'district_admin'
        AND actor.district_id IS NOT NULL
        AND target.district_id = actor.district_id
      )
      OR (
        actor.role = 'admin'
        AND actor.school_id IS NOT NULL
        AND target.school_id = actor.school_id
      )
    )
      AND (
        requested_school_id IS NULL
        OR target.school_id = requested_school_id
      )
      AND (
        normalized_role IS NULL
        OR target.role = normalized_role
      )
      AND (
        normalized_search IS NULL
        OR STRPOS(
          LOWER(CONCAT_WS(' ', target.full_name, target.email, school.name, district.name)),
          normalized_search
        ) > 0
      )
  ),
  counted_users AS (
    SELECT scoped_users.*, COUNT(*) OVER () AS total_count
    FROM scoped_users
  )
  SELECT
    scoped.id,
    scoped.school_id,
    scoped.district_id,
    scoped.full_name,
    scoped.email,
    scoped.grade_level,
    scoped.avatar_url,
    scoped.role,
    scoped.account_status,
    scoped.graduation_year,
    scoped.onboarding_reset_at,
    scoped.created_at,
    scoped.updated_at,
    scoped.school_name,
    scoped.district_name,
    COALESCE(assignments.items, '[]'::JSONB),
    scoped.total_count
  FROM counted_users scoped
  LEFT JOIN LATERAL (
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'club_id', membership.club_id,
        'club_name', club.name,
        'club_slug', club.slug,
        'role', membership.role,
        'status', membership.status
      )
      ORDER BY club.name, membership.club_id
    ) AS items
    FROM public.club_memberships membership
    JOIN public.clubs club ON club.id = membership.club_id
    WHERE membership.user_id = scoped.id
      AND scoped.school_id IS NOT NULL
      AND club.school_id = scoped.school_id
  ) assignments ON TRUE
  ORDER BY scoped.created_at DESC NULLS LAST, scoped.id
  LIMIT normalized_page_size
  OFFSET (normalized_page - 1) * normalized_page_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_admin_user_inventory(INTEGER, INTEGER, TEXT, UUID, TEXT) IS
  'Paginated administrator user inventory: platform-wide for super admins, district-scoped for district admins, and school-scoped for school admins.';
COMMENT ON FUNCTION public.can_read_admin_profile(UUID, UUID) IS
  'Tenant-bound administrative profile visibility used by administrative tools.';
COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Own profile, assigned school, assigned district, or platform-wide super-admin inventory; no cross-tenant school/district reads.';

COMMIT;
