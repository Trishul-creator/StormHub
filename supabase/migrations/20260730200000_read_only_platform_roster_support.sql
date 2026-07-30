-- Platform administrators may inspect a school only through a time-limited,
-- audited support session. Support access is deliberately read-only, so the
-- roster mutation RPC must not inherit the platform-wide can_admin_club grant.
BEGIN;

-- Generic user management is limited to school-level accounts. Elevated role
-- assignment remains in the dedicated district/platform workspace workflow.
ALTER FUNCTION public.admin_set_user_role_and_clubs(
  UUID,
  TEXT,
  UUID[]
) RENAME TO admin_set_user_role_and_clubs_internal;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs_internal(
  UUID,
  TEXT,
  UUID[]
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  target_role TEXT;
BEGIN
  SELECT role
  INTO target_role
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_role IN ('district_admin', 'super_admin')
    OR new_role IN ('district_admin', 'super_admin')
  THEN
    RAISE EXCEPTION 'Elevated account assignments are managed from the district workspace';
  END IF;

  PERFORM public.admin_set_user_role_and_clubs_internal(
    target_user_id,
    new_role,
    assigned_club_ids
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[])
  TO authenticated;

ALTER FUNCTION public.admin_set_account_status(
  UUID,
  TEXT
) RENAME TO admin_set_account_status_internal;

REVOKE ALL ON FUNCTION public.admin_set_account_status_internal(
  UUID,
  TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_set_account_status(
  target_user_id UUID,
  new_status TEXT
)
RETURNS VOID AS $$
DECLARE
  target_role TEXT;
BEGIN
  SELECT role
  INTO target_role
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_role IN ('district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Elevated account status is managed from the district workspace';
  END IF;

  PERFORM public.admin_set_account_status_internal(target_user_id, new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_account_status(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_club_roster_member(
  target_club_id UUID,
  target_user_id UUID,
  new_membership_role TEXT,
  remove_member BOOLEAN DEFAULT FALSE,
  ban_member BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  target_profile_role TEXT;
  target_current_role TEXT;
  has_full_roster_access BOOLEAN;
  actor_profile_role TEXT;
BEGIN
  SELECT role
  INTO actor_profile_role
  FROM public.profiles
  WHERE id = auth.uid()
    AND account_status = 'active';

  IF actor_profile_role = 'super_admin' THEN
    RAISE EXCEPTION 'Platform support access is read-only';
  END IF;
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own roster assignment';
  END IF;

  has_full_roster_access :=
    public.can_admin_club(target_club_id) OR public.is_club_advisor(target_club_id);

  SELECT p.role, m.role
  INTO target_profile_role, target_current_role
  FROM public.profiles p
  LEFT JOIN public.club_memberships m
    ON m.user_id = p.id AND m.club_id = target_club_id
  WHERE p.id = target_user_id;

  IF target_profile_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_current_role = 'sponsor' THEN
    RAISE EXCEPTION 'Advisor assignments are managed by school administrators';
  END IF;

  IF NOT has_full_roster_access THEN
    IF target_current_role IS DISTINCT FROM 'member'
      OR NOT remove_member
      OR ban_member
      OR new_membership_role IS DISTINCT FROM 'member'
    THEN
      RAISE EXCEPTION 'Vice Presidents can remove general members; an Advisor must manage leadership roles and bans';
    END IF;
  END IF;

  IF ban_member THEN
    IF NOT has_full_roster_access THEN RAISE EXCEPTION 'Advisor access required to ban members'; END IF;
    INSERT INTO public.club_member_bans (club_id, user_id, banned_by)
    VALUES (target_club_id, target_user_id, auth.uid())
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET banned_by = EXCLUDED.banned_by, created_at = NOW();
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE club_id = target_club_id AND user_id = target_user_id;
    RETURN;
  END IF;

  IF remove_member THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE club_id = target_club_id AND user_id = target_user_id;
    RETURN;
  END IF;

  IF target_profile_role <> 'student' THEN
    RAISE EXCEPTION 'Only students can be assigned Member, Vice President, or President roles';
  END IF;
  IF new_membership_role NOT IN ('member', 'officer', 'president') THEN
    RAISE EXCEPTION 'Invalid student club role';
  END IF;

  INSERT INTO public.club_memberships (club_id, user_id, status, role)
  VALUES (target_club_id, target_user_id, 'active', new_membership_role)
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET status = 'active', role = EXCLUDED.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

-- Membership rows contain private roster workflow state. Platform support can
-- read them only while an active support session exists for the exact school.
DROP POLICY IF EXISTS "memberships_read" ON public.club_memberships;
CREATE POLICY "memberships_read"
  ON public.club_memberships FOR SELECT TO authenticated
  USING (
    (
      NOT public.is_super_admin()
      AND (
        club_memberships.user_id = auth.uid()
        OR public.is_club_advisor(club_id)
        OR public.can_admin_club(club_id)
      )
    )
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1
        FROM public.clubs club
        WHERE club.id = club_memberships.club_id
          AND public.has_active_platform_support_access(club.school_id)
      )
    )
  );

-- Platform support is read-only even when can_admin_club resolves globally.
-- Students retain only their own constrained leave/reactivate behavior; school
-- and district administrators retain their scoped administrative branch.
DROP POLICY IF EXISTS "memberships_update_own" ON public.club_memberships;
CREATE POLICY "memberships_update_own"
  ON public.club_memberships FOR UPDATE TO authenticated
  USING (
    (
      club_memberships.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles actor
        WHERE actor.id = auth.uid()
          AND actor.role = 'student'
          AND actor.account_status = 'active'
      )
    )
    OR (
      NOT public.is_super_admin()
      AND public.can_admin_club(club_id)
    )
  )
  WITH CHECK (
    (
      club_memberships.user_id = auth.uid()
      AND role = 'member'
      AND status IN ('active', 'left')
      AND EXISTS (
        SELECT 1
        FROM public.profiles actor
        WHERE actor.id = auth.uid()
          AND actor.role = 'student'
          AND actor.account_status = 'active'
      )
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
    OR (
      NOT public.is_super_admin()
      AND public.can_admin_club(club_id)
    )
  );

DROP POLICY IF EXISTS "memberships_delete_own" ON public.club_memberships;
CREATE POLICY "memberships_delete_own"
  ON public.club_memberships FOR DELETE TO authenticated
  USING (
    (
      club_memberships.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles actor
        WHERE actor.id = auth.uid()
          AND actor.role = 'student'
          AND actor.account_status = 'active'
      )
    )
    OR (
      NOT public.is_super_admin()
      AND public.can_admin_club(club_id)
    )
  );

-- Platform-wide profile discovery is available only through the audited,
-- privacy-minimized inventory RPC below. Direct profile rows require an exact
-- school support session, while ordinary tenant administrators remain scoped.
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      NOT public.is_super_admin()
      AND public.can_read_admin_profile(school_id, district_id)
    )
    OR (
      public.is_super_admin()
      AND school_id IS NOT NULL
      AND public.has_active_platform_support_access(school_id)
    )
  );

DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
CREATE POLICY "profiles_admin_manage"
  ON public.profiles FOR ALL TO authenticated
  USING (
    NOT public.is_super_admin()
    AND public.can_admin_school(school_id)
  )
  WITH CHECK (
    NOT public.is_super_admin()
    AND public.can_admin_school(school_id)
  );

COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Own profile; tenant-scoped school/district administration; or an exact active school support session. Platform-wide directory access uses the audited inventory RPC.';

-- Keep the administrator inventory available at each authorized scope while
-- recording every RPC call. The wrapper returns only fields rendered by the
-- administrative directory; student lifecycle and profile-decoration fields
-- remain outside this platform-wide view.
ALTER FUNCTION public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) RENAME TO get_admin_user_inventory_unlogged;

REVOKE ALL ON FUNCTION public.get_admin_user_inventory_unlogged(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) FROM PUBLIC, anon, authenticated, service_role;

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
  user_role TEXT,
  account_status TEXT,
  school_name TEXT,
  district_name TEXT,
  club_assignments JSONB,
  total_count BIGINT
) AS $$
DECLARE
  normalized_page INTEGER := GREATEST(COALESCE(requested_page, 1), 1);
  normalized_page_size INTEGER := LEAST(GREATEST(COALESCE(requested_page_size, 50), 1), 100);
  normalized_role TEXT := NULLIF(LOWER(BTRIM(COALESCE(requested_role, ''))), '');
  search_used BOOLEAN := NULLIF(BTRIM(COALESCE(search_text, '')), '') IS NOT NULL;
  actor_role TEXT;
BEGIN
  SELECT actor.role
  INTO actor_role
  FROM public.profiles actor
  WHERE actor.id = auth.uid()
    AND actor.account_status = 'active';

  RETURN QUERY
  SELECT
    inventory.user_id,
    inventory.school_id,
    inventory.district_id,
    inventory.full_name,
    inventory.email,
    inventory.user_role,
    inventory.account_status,
    inventory.school_name,
    inventory.district_name,
    CASE
      WHEN actor_role = 'super_admin'
        AND (
          requested_school_id IS NULL
          OR NOT public.has_active_platform_support_access(requested_school_id)
        )
      THEN '[]'::JSONB
      ELSE inventory.club_assignments
    END,
    inventory.total_count
  FROM public.get_admin_user_inventory_unlogged(
    requested_page,
    requested_page_size,
    search_text,
    requested_school_id,
    requested_role
  ) inventory;

  INSERT INTO public.admin_audit_log (
    school_id,
    actor_user_id,
    action,
    entity_type,
    new_data
  ) VALUES (
    requested_school_id,
    auth.uid(),
    'view',
    'user_inventory',
    JSONB_BUILD_OBJECT(
      'page', normalized_page,
      'page_size', normalized_page_size,
      'role', normalized_role,
      'search_used', search_used
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_inventory(
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_admin_user_inventory(INTEGER, INTEGER, TEXT, UUID, TEXT) IS
  'Paginated, scoped administrator user inventory with one PII-free audit event per authorized call.';

COMMIT;
