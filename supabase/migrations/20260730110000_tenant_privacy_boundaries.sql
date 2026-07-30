-- Close tenant-boundary gaps in public school discovery, school workspaces,
-- club counts, and managed rosters. Public pages use fictional application
-- data; the only anonymous school lookup is the intentionally limited signup
-- chooser below.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_school(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    LEFT JOIN public.schools school ON school.id = school_uuid
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (
          actor.role = 'district_admin'
          AND actor.district_id IS NOT NULL
          AND actor.district_id = school.district_id
        )
        OR (
          actor.role IN ('student', 'teacher', 'admin')
          AND actor.school_id = school_uuid
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_view_school(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_school(UUID) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.list_signup_schools();
CREATE FUNCTION public.list_signup_schools()
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
  ORDER BY school.name, school.id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.list_signup_schools() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO anon, authenticated, service_role;

-- The table itself is never public. Signup receives only the six fields
-- returned by list_signup_schools().
REVOKE ALL ON TABLE public.schools FROM anon;
REVOKE ALL ON TABLE public.school_settings FROM anon;
GRANT SELECT ON TABLE public.schools TO authenticated;

DROP POLICY IF EXISTS "schools_public_read" ON public.schools;
DROP POLICY IF EXISTS "schools_authenticated_read" ON public.schools;
CREATE POLICY "schools_authenticated_read"
  ON public.schools FOR SELECT TO authenticated
  USING (public.can_view_school(id));

DROP POLICY IF EXISTS "school_settings_read" ON public.school_settings;
CREATE POLICY "school_settings_read"
  ON public.school_settings FOR SELECT TO authenticated
  USING (public.can_view_school(school_id));

-- Real published content follows the same school/district/platform boundary.
-- Management branches remain available only through the existing club/admin
-- authorization helpers.
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read"
  ON public.clubs FOR SELECT TO authenticated
  USING (
    (
      public.can_view_school(school_id)
      AND is_active = TRUE
      AND is_listed = TRUE
      AND visibility = 'public'
      AND status IN ('interest_open', 'active')
    )
    OR public.can_manage_club(id)
    OR public.can_admin_school(school_id)
  );

DROP POLICY IF EXISTS "announcements_read" ON public.club_announcements;
CREATE POLICY "announcements_read"
  ON public.club_announcements FOR SELECT TO authenticated
  USING (
    (
      status = 'approved'
      AND visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.clubs club
        WHERE club.id = club_announcements.club_id
          AND public.can_view_school(club.school_id)
      )
    )
    OR (
      status = 'approved'
      AND visibility = 'members'
      AND public.is_club_member(club_id)
    )
    OR public.can_manage_club(club_id)
    OR public.can_admin_club(club_id)
  );

DROP POLICY IF EXISTS "resources_read" ON public.club_resources;
CREATE POLICY "resources_read"
  ON public.club_resources FOR SELECT TO authenticated
  USING (
    (
      status = 'approved'
      AND visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.clubs club
        WHERE club.id = club_resources.club_id
          AND public.can_view_school(club.school_id)
      )
    )
    OR (
      status = 'approved'
      AND visibility = 'members'
      AND public.is_club_member(club_id)
    )
    OR public.can_manage_club(club_id)
    OR public.can_admin_club(club_id)
  );

DROP POLICY IF EXISTS "opportunities_read" ON public.opportunities;
CREATE POLICY "opportunities_read"
  ON public.opportunities FOR SELECT TO authenticated
  USING (
    (
      public.can_view_school(school_id)
      AND status = 'approved'
      AND visibility = 'public'
    )
    OR public.can_admin_school(school_id)
  );

DROP POLICY IF EXISTS "events_read" ON public.events;
CREATE POLICY "events_read"
  ON public.events FOR SELECT TO authenticated
  USING (
    (
      public.can_view_school(school_id)
      AND status = 'approved'
      AND visibility = 'public'
    )
    OR (
      status = 'approved'
      AND visibility = 'members'
      AND club_id IS NOT NULL
      AND public.is_club_member(club_id)
    )
    OR (
      club_id IS NOT NULL
      AND public.can_manage_club(club_id)
    )
    OR public.can_admin_school(school_id)
  );

-- Student leaders use the roster RPC below. Direct membership rows include
-- workflow status and timestamps, so bulk table access is limited to Advisors
-- and scoped administrators. Every user can still read their own membership.
DROP POLICY IF EXISTS "memberships_read" ON public.club_memberships;
CREATE POLICY "memberships_read"
  ON public.club_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_advisor(club_id)
    OR public.can_admin_club(club_id)
  );

-- A membership UUID is not an authorization token. Students may only join a
-- listed, active club in their own active school. This also prevents a stale
-- "left" row from being reactivated after a club becomes private or moves
-- outside the student's tenant.
DROP POLICY IF EXISTS "memberships_insert_own" ON public.club_memberships;
CREATE POLICY "memberships_insert_own"
  ON public.club_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status IN ('active', 'pending')
    AND EXISTS (
      SELECT 1
      FROM public.profiles actor
      JOIN public.clubs club ON club.id = club_memberships.club_id
      JOIN public.schools school ON school.id = club.school_id
      WHERE actor.id = auth.uid()
        AND actor.role = 'student'
        AND actor.account_status = 'active'
        AND actor.school_id = club.school_id
        AND school.is_active = TRUE
        AND club.is_active = TRUE
        AND club.is_listed = TRUE
        AND club.visibility = 'public'
        AND club.status IN ('interest_open', 'active')
    )
  );

DROP POLICY IF EXISTS "memberships_update_own" ON public.club_memberships;
CREATE POLICY "memberships_update_own"
  ON public.club_memberships FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_admin_club(club_id)
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND role = 'member'
      AND status IN ('active', 'left')
      AND (
        status = 'left'
        OR EXISTS (
          SELECT 1
          FROM public.profiles actor
          JOIN public.clubs club ON club.id = club_memberships.club_id
          JOIN public.schools school ON school.id = club.school_id
          WHERE actor.id = auth.uid()
            AND actor.role = 'student'
            AND actor.account_status = 'active'
            AND actor.school_id = club.school_id
            AND school.is_active = TRUE
            AND club.is_active = TRUE
            AND club.is_listed = TRUE
            AND club.visibility = 'public'
            AND club.status IN ('interest_open', 'active')
        )
      )
    )
    OR public.can_admin_club(club_id)
  );

CREATE OR REPLACE FUNCTION public.protect_membership_identity_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.club_id IS DISTINCT FROM OLD.club_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.joined_at IS DISTINCT FROM OLD.joined_at
  THEN
    RAISE EXCEPTION 'Membership identity and join time cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS memberships_protect_identity_fields
  ON public.club_memberships;
CREATE TRIGGER memberships_protect_identity_fields
  BEFORE UPDATE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.protect_membership_identity_fields();

REVOKE ALL ON FUNCTION public.protect_membership_identity_fields()
  FROM PUBLIC, anon, authenticated;

-- Broad profile-row access is not required for roster management. The limited
-- RPC returns only fields approved for the current actor.
DROP POLICY IF EXISTS "profiles_roster_read" ON public.profiles;

DROP FUNCTION IF EXISTS public.get_visible_club_member_counts(UUID[]);
CREATE FUNCTION public.get_visible_club_member_counts(club_uuids UUID[])
RETURNS TABLE (
  club_id UUID,
  member_count BIGINT
) AS $$
  SELECT
    club.id,
    COUNT(membership.id) FILTER (
      WHERE member_profile.account_status = 'active'
    )::BIGINT
  FROM public.clubs club
  LEFT JOIN public.club_memberships membership
    ON membership.club_id = club.id
    AND membership.status = 'active'
  LEFT JOIN public.profiles member_profile
    ON member_profile.id = membership.user_id
  WHERE club.id = ANY(COALESCE(club_uuids, ARRAY[]::UUID[]))
    AND (
      (
        public.can_view_school(club.school_id)
        AND club.is_active = TRUE
        AND club.is_listed = TRUE
        AND club.visibility = 'public'
        AND club.status IN ('interest_open', 'active')
      )
      OR public.can_manage_club(club.id)
      OR public.can_admin_club(club.id)
    )
  GROUP BY club.id
  ORDER BY club.id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_visible_club_member_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visible_club_member_counts(UUID[])
  TO authenticated, service_role;

-- Remove the join timestamp from the general member directory. Members see
-- names and club roles only; non-roster managers continue to receive a
-- privacy-minimized display name.
DROP FUNCTION IF EXISTS public.get_club_member_directory(UUID);
CREATE FUNCTION public.get_club_member_directory(club_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  membership_role TEXT
) AS $$
DECLARE
  can_view_full_names BOOLEAN;
  actor_role TEXT;
  target_school_id UUID;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT school_id INTO target_school_id FROM public.clubs WHERE id = club_uuid;
  IF actor_role = 'super_admin'
    AND NOT public.has_active_platform_support_access(target_school_id)
  THEN
    RAISE EXCEPTION 'Start a school support session to view this roster';
  END IF;

  IF NOT (
    public.is_club_member(club_uuid)
    OR public.can_manage_club(club_uuid)
    OR public.can_manage_club_coursework(club_uuid)
  ) THEN
    RAISE EXCEPTION 'Club membership required';
  END IF;

  can_view_full_names :=
    (
      actor_role IS DISTINCT FROM 'super_admin'
      AND (
        public.can_manage_club_roster(club_uuid)
        OR public.can_grade_club_coursework(club_uuid)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.clubs club
      WHERE club.id = club_uuid
        AND public.has_active_platform_support_access(club.school_id)
    );

  RETURN QUERY
  SELECT
    profile.id,
    CASE
      WHEN can_view_full_names
        THEN COALESCE(NULLIF(BTRIM(profile.full_name), ''), 'Club member')
      ELSE public.privacy_safe_member_name(profile.full_name)
    END,
    profile.avatar_url,
    membership.role
  FROM public.club_memberships membership
  JOIN public.profiles profile ON profile.id = membership.user_id
  WHERE membership.club_id = club_uuid
    AND membership.status = 'active'
    AND profile.account_status = 'active'
  ORDER BY
    CASE membership.role
      WHEN 'sponsor' THEN 1
      WHEN 'president' THEN 2
      WHEN 'officer' THEN 3
      ELSE 4
    END,
    COALESCE(profile.full_name, ''),
    profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_club_member_directory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_member_directory(UUID)
  TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_club_roster(UUID);
CREATE FUNCTION public.get_club_roster(club_uuid UUID)
RETURNS TABLE (
  membership_id UUID,
  club_id UUID,
  user_id UUID,
  membership_role TEXT,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT
) AS $$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
  target_school_id UUID;
  can_view_email BOOLEAN := FALSE;
BEGIN
  SELECT club.school_id INTO target_school_id
  FROM public.clubs club
  WHERE club.id = club_uuid;
  IF target_school_id IS NULL THEN RAISE EXCEPTION 'Club not found'; END IF;

  IF NOT public.can_manage_club_roster(club_uuid) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;

  SELECT role, school_id
  INTO actor_role, actor_school_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_role = 'super_admin'
    AND NOT public.has_active_platform_support_access(target_school_id)
  THEN
    RAISE EXCEPTION 'Start a school support session to view this roster';
  END IF;

  can_view_email :=
    public.is_club_advisor(club_uuid)
    OR (
      actor_role = 'admin'
      AND actor_school_id = target_school_id
    );

  RETURN QUERY
  SELECT
    membership.id,
    membership.club_id,
    membership.user_id,
    membership.role,
    COALESCE(NULLIF(BTRIM(profile.full_name), ''), 'Club member'),
    profile.avatar_url,
    CASE WHEN can_view_email THEN profile.email ELSE NULL END
  FROM public.club_memberships membership
  JOIN public.profiles profile ON profile.id = membership.user_id
  WHERE membership.club_id = club_uuid
    AND membership.status = 'active'
    AND profile.account_status = 'active'
  ORDER BY
    CASE membership.role
      WHEN 'sponsor' THEN 1
      WHEN 'president' THEN 2
      WHEN 'officer' THEN 3
      ELSE 4
    END,
    COALESCE(profile.full_name, ''),
    profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_club_roster(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_roster(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_signup_schools() IS
  'Public signup chooser containing only non-sensitive active-school fields.';
COMMENT ON FUNCTION public.get_visible_club_member_counts(UUID[]) IS
  'Aggregate active membership counts for clubs visible to the authenticated caller.';
COMMENT ON FUNCTION public.get_club_roster(UUID) IS
  'Least-privilege managed roster. Student leaders never receive profile email or account metadata.';

COMMIT;
