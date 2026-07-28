-- Public StormHub pages render the fictional application showcase. Real school
-- content requires an authenticated, active account and remains school-scoped.

DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_user()
      AND is_listed = TRUE
      AND visibility = 'public'
      AND status IN ('interest_open', 'active')
      AND (
        school_id = public.current_user_school_id()
        OR public.is_super_admin()
      )
    )
    OR public.can_manage_club(id)
    OR public.can_admin_school(school_id)
  );

DROP POLICY IF EXISTS "announcements_read" ON public.club_announcements;
CREATE POLICY "announcements_read" ON public.club_announcements
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_user()
      AND status = 'approved'
      AND visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.clubs club
        WHERE club.id = club_announcements.club_id
          AND (
            club.school_id = public.current_user_school_id()
            OR public.is_super_admin()
          )
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
CREATE POLICY "resources_read" ON public.club_resources
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_user()
      AND status = 'approved'
      AND visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.clubs club
        WHERE club.id = club_resources.club_id
          AND (
            club.school_id = public.current_user_school_id()
            OR public.is_super_admin()
          )
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
CREATE POLICY "opportunities_read" ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_user()
      AND status = 'approved'
      AND visibility = 'public'
      AND (
        school_id = public.current_user_school_id()
        OR public.is_super_admin()
      )
    )
    OR public.can_admin_school(school_id)
  );

DROP POLICY IF EXISTS "events_read" ON public.events;
CREATE POLICY "events_read" ON public.events
  FOR SELECT TO authenticated
  USING (
    (
      public.is_active_user()
      AND status = 'approved'
      AND visibility = 'public'
      AND (
        school_id = public.current_user_school_id()
        OR public.is_super_admin()
      )
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
