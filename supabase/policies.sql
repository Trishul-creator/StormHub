-- StormHub Row Level Security Policies
-- Safe to re-run after schema.sql. Policies are dropped before recreation.

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_notification_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.importance IS DISTINCT FROM OLD.importance
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.link IS DISTINCT FROM OLD.link
    OR NEW.club_id IS DISTINCT FROM OLD.club_id
    OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only notification read state can be updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS notifications_prevent_content_update ON public.notifications;
CREATE TRIGGER notifications_prevent_content_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_notification_content_update();

CREATE OR REPLACE FUNCTION public.can_approve_content()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_member(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = club_uuid
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (
        (p.role = 'student' AND m.role IN ('officer', 'president'))
        OR (p.role = 'teacher' AND m.role = 'sponsor')
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club_roster(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND p.role = 'teacher'
      AND m.role = 'sponsor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  actor_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;
  IF actor_role NOT IN ('admin', 'super_admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF actor_role = 'admin' AND (
    target_role NOT IN ('student', 'teacher') OR new_role NOT IN ('student', 'teacher')
  ) THEN RAISE EXCEPTION 'Only a super admin can modify admin-level accounts'; END IF;
  IF new_role = 'teacher' AND COALESCE(array_length(assigned_club_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'A teacher must be assigned to at least one club';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
  UPDATE public.club_memberships
  SET role = 'member', status = 'left'
  WHERE user_id = target_user_id
    AND role = 'sponsor'
    AND (new_role <> 'teacher' OR NOT (club_id = ANY(assigned_club_ids)));

  IF new_role = 'teacher' THEN
    UPDATE public.club_memberships
    SET role = 'member', status = 'left'
    WHERE user_id = target_user_id
      AND NOT (club_id = ANY(assigned_club_ids));
    INSERT INTO public.club_memberships (club_id, user_id, status, role)
    SELECT assigned.club_id, target_user_id, 'active', 'sponsor'
    FROM unnest(assigned_club_ids) AS assigned(club_id)
    WHERE EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = assigned.club_id)
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET status = 'active', role = 'sponsor';
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.manage_club_roster_member(
  target_club_id UUID,
  target_user_id UUID,
  new_membership_role TEXT,
  remove_member BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  target_profile_role TEXT;
BEGIN
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Teacher sponsor or administrator access required';
  END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own roster assignment'; END IF;
  SELECT role INTO target_profile_role FROM public.profiles WHERE id = target_user_id;
  IF target_profile_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF remove_member THEN
    UPDATE public.club_memberships SET status = 'left', role = 'member'
    WHERE club_id = target_club_id AND user_id = target_user_id;
    RETURN;
  END IF;
  IF target_profile_role <> 'student' THEN
    RAISE EXCEPTION 'Only students can be assigned member, officer, or president roles';
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

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN) TO authenticated;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'schools', 'profiles', 'clubs', 'club_memberships',
        'club_announcements', 'club_resources', 'opportunities', 'events',
        'event_rsvps', 'bookmarks', 'workshops', 'service_hours',
        'interest_forms', 'approval_requests', 'analytics_events', 'feedback',
        'notifications', 'notification_preferences', 'email_outbox'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END $$;

CREATE POLICY "schools_public_read" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_super_admin_write" ON schools FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "profiles_read" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_roster_read" ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships m
      WHERE m.user_id = profiles.id AND can_manage_club_roster(m.club_id)
    )
  );
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'student');
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_manage" ON profiles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "clubs_public_read" ON clubs FOR SELECT
  USING (
    (is_listed = true AND visibility = 'public' AND status IN ('interest_open', 'active'))
    OR can_manage_club(id)
    OR is_admin()
  );
CREATE POLICY "clubs_admin_manage" ON clubs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "clubs_officer_update" ON clubs FOR UPDATE
  USING (can_manage_club(id))
  WITH CHECK (can_manage_club(id));

CREATE POLICY "memberships_read" ON club_memberships FOR SELECT
  USING (user_id = auth.uid() OR can_manage_club(club_id) OR can_manage_club_roster(club_id) OR is_admin());
CREATE POLICY "memberships_insert_own" ON club_memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status IN ('active', 'pending')
  );
CREATE POLICY "memberships_update_own" ON club_memberships FOR UPDATE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin())
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'left'))
    OR can_manage_club_roster(club_id)
    OR is_admin()
  );
CREATE POLICY "memberships_delete_own" ON club_memberships FOR DELETE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin());

CREATE POLICY "announcements_read" ON club_announcements FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND is_club_member(club_id))
    OR can_manage_club(club_id)
    OR is_admin()
  );
CREATE POLICY "announcements_manage" ON club_announcements FOR ALL
  USING (can_manage_club(club_id) OR is_admin())
  WITH CHECK (can_manage_club(club_id) OR is_admin());
CREATE POLICY "announcements_approve" ON club_announcements FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));

CREATE POLICY "resources_read" ON club_resources FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND is_club_member(club_id))
    OR can_manage_club(club_id)
    OR is_admin()
  );
CREATE POLICY "resources_manage" ON club_resources FOR ALL
  USING (can_manage_club(club_id) OR is_admin())
  WITH CHECK (can_manage_club(club_id) OR is_admin());
CREATE POLICY "resources_approve" ON club_resources FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));

CREATE POLICY "opportunities_read" ON opportunities FOR SELECT
  USING (
    (
      status = 'approved'
      AND visibility = 'public'
      AND (auth.uid() IS NULL OR get_user_role() <> 'teacher')
    )
    OR is_admin()
  );
CREATE POLICY "opportunities_manage" ON opportunities FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);
CREATE POLICY "opportunities_approve" ON opportunities FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);

CREATE POLICY "events_read" ON events FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND club_id IS NOT NULL AND is_club_member(club_id))
    OR (club_id IS NOT NULL AND can_manage_club(club_id))
    OR is_admin()
  );
CREATE POLICY "events_manage" ON events FOR ALL
  USING (is_admin() OR (club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (club_id IS NOT NULL AND can_manage_club(club_id)));
CREATE POLICY "events_approve" ON events FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));

CREATE POLICY "rsvps_read" ON event_rsvps FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "rsvps_insert_own" ON event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_update_own" ON event_rsvps FOR UPDATE
  USING (user_id = auth.uid() AND get_user_role() = 'student')
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_delete_own" ON event_rsvps FOR DELETE
  USING (user_id = auth.uid() AND get_user_role() = 'student');

CREATE POLICY "bookmarks_read_own" ON bookmarks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "bookmarks_insert_own" ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (opportunity_id IS NULL OR get_user_role() = 'student'));
CREATE POLICY "bookmarks_update_own" ON bookmarks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (opportunity_id IS NULL OR get_user_role() = 'student'));
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "workshops_read" ON workshops FOR SELECT
  USING (
    status = 'approved'
    OR is_admin()
    OR (club_id IS NOT NULL AND get_user_role() = 'teacher' AND can_manage_club(club_id))
  );
CREATE POLICY "workshops_insert" ON workshops FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND host_user_id = auth.uid());
CREATE POLICY "workshops_owner_update" ON workshops FOR UPDATE
  USING (host_user_id = auth.uid() OR is_admin())
  WITH CHECK (host_user_id = auth.uid() OR is_admin());
CREATE POLICY "workshops_approve" ON workshops FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));

-- Volunteering/service hours disabled because school uses a separate system.
-- RLS remains enabled and no client policies are created, so the preserved
-- table is inaccessible through the application.

CREATE POLICY "interest_forms_insert" ON interest_forms FOR INSERT WITH CHECK (true);
CREATE POLICY "interest_forms_admin_read" ON interest_forms FOR SELECT USING (is_admin());

CREATE POLICY "approvals_read" ON approval_requests FOR SELECT
  USING (submitted_by = auth.uid() OR can_approve_content());
CREATE POLICY "approvals_insert_own" ON approval_requests FOR INSERT
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "approvals_approver_update" ON approval_requests FOR UPDATE
  USING (can_approve_content())
  WITH CHECK (can_approve_content());

CREATE POLICY "analytics_insert" ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "analytics_admin_read" ON analytics_events FOR SELECT USING (is_admin());

CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback_admin_read" ON feedback FOR SELECT USING (is_admin());

CREATE POLICY "notifications_read_own" ON notifications FOR SELECT
  USING (recipient_user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

CREATE POLICY "notification_preferences_read_own" ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "notification_preferences_insert_own" ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notification_preferences_update_own" ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "email_outbox_admin_read" ON email_outbox FOR SELECT
  USING (is_admin());
