BEGIN;

-- StormHub keeps the original stored values so existing memberships continue to
-- work. In the product, sponsor = Advisor and officer = Vice President.
COMMENT ON COLUMN public.club_memberships.role IS
  'Club role: sponsor (Advisor), president (President), officer (Vice President), or member (Member).';

CREATE OR REPLACE FUNCTION public.is_club_advisor(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role = 'sponsor'
      AND p.role = 'teacher'
      AND p.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_president(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role = 'president'
      AND p.role = 'student'
      AND p.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_vice_president(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role = 'officer'
      AND p.role = 'student'
      AND p.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club_roster(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid)
    OR public.is_club_advisor(club_uuid)
    OR public.is_club_vice_president(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_create_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid)
    OR public.is_club_advisor(club_uuid)
    OR public.is_club_president(club_uuid)
    OR public.is_club_vice_president(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_publish_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid)
    OR public.is_club_advisor(club_uuid)
    OR public.is_club_president(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_grade_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid)
    OR public.is_club_advisor(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_track_club_submissions(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_create_club_coursework(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Compatibility name used by existing application code and earlier migrations.
CREATE OR REPLACE FUNCTION public.can_manage_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_create_club_coursework(club_uuid);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE TABLE IF NOT EXISTS public.club_member_bans (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

ALTER TABLE public.club_member_bans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_member_bans FROM anon, authenticated;
GRANT ALL ON TABLE public.club_member_bans TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_banned_club_rejoin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('active', 'pending') AND EXISTS (
    SELECT 1 FROM public.club_member_bans b
    WHERE b.club_id = NEW.club_id AND b.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'You have been blocked from joining this club';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS memberships_prevent_banned_rejoin ON public.club_memberships;
CREATE TRIGGER memberships_prevent_banned_rejoin
  BEFORE INSERT OR UPDATE OF status ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_banned_club_rejoin();

DROP FUNCTION IF EXISTS public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN);
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
BEGIN
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

-- A Vice President can see the roster and remove general members through the guarded
-- RPC, but cannot directly update leadership rows.
DROP POLICY IF EXISTS "memberships_update_own" ON public.club_memberships;
CREATE POLICY "memberships_update_own" ON public.club_memberships FOR UPDATE
  USING (user_id = auth.uid() OR public.can_admin_club(club_id))
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'left'))
    OR public.can_admin_club(club_id)
  );
DROP POLICY IF EXISTS "memberships_delete_own" ON public.club_memberships;
CREATE POLICY "memberships_delete_own" ON public.club_memberships FOR DELETE
  USING (user_id = auth.uid() OR public.can_admin_club(club_id));

CREATE OR REPLACE FUNCTION public.enforce_assignment_role_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.can_create_club_coursework(NEW.club_id) THEN
    RAISE EXCEPTION 'Club leadership access required';
  END IF;
  IF public.can_publish_club_coursework(NEW.club_id) THEN RETURN NEW; END IF;
  IF NEW.status <> 'draft' OR NEW.published_at IS NOT NULL OR NEW.scheduled_for IS NOT NULL THEN
    RAISE EXCEPTION 'Only the President, Advisor, or an administrator can publish or schedule assignments';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Vice Presidents can edit draft assignments only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS assignments_enforce_role_permissions ON public.club_assignments;
CREATE TRIGGER assignments_enforce_role_permissions
  BEFORE INSERT OR UPDATE ON public.club_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_role_permissions();

DROP POLICY IF EXISTS "assignments_read" ON public.club_assignments;
CREATE POLICY "assignments_read" ON public.club_assignments FOR SELECT TO authenticated
  USING (
    (status IN ('published', 'closed') AND public.is_club_member(club_id))
    OR public.can_create_club_coursework(club_id)
  );
DROP POLICY IF EXISTS "assignments_manage" ON public.club_assignments;
CREATE POLICY "assignments_manage" ON public.club_assignments FOR ALL TO authenticated
  USING (public.can_create_club_coursework(club_id))
  WITH CHECK (public.can_create_club_coursework(club_id));

DROP POLICY IF EXISTS "assignment_submissions_read" ON public.club_assignment_submissions;
CREATE POLICY "assignment_submissions_read" ON public.club_assignment_submissions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments a
      WHERE a.id = assignment_id AND public.can_grade_club_coursework(a.club_id)
    )
  );
DROP POLICY IF EXISTS "submission_attachments_read" ON public.club_submission_attachments;
CREATE POLICY "submission_attachments_read" ON public.club_submission_attachments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments a
      WHERE a.id = assignment_id AND public.can_grade_club_coursework(a.club_id)
    )
  );
DROP POLICY IF EXISTS "student_copies_read" ON public.club_assignment_student_copies;
CREATE POLICY "student_copies_read" ON public.club_assignment_student_copies FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments a
      WHERE a.id = assignment_id AND public.can_grade_club_coursework(a.club_id)
    )
  );

CREATE OR REPLACE FUNCTION public.get_club_assignment_submission_statuses(assignment_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  membership_role TEXT,
  submission_id UUID,
  submission_status TEXT,
  submitted_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ
) AS $$
DECLARE
  target_club_id UUID;
BEGIN
  SELECT club_id INTO target_club_id
  FROM public.club_assignments
  WHERE id = assignment_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF NOT public.can_track_club_submissions(target_club_id) THEN
    RAISE EXCEPTION 'Club leadership access required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Club member'),
    p.avatar_url,
    m.role,
    s.id,
    s.status,
    s.submitted_at,
    s.graded_at
  FROM public.club_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.club_assignment_submissions s
    ON s.assignment_id = assignment_uuid AND s.student_id = m.user_id
  WHERE m.club_id = target_club_id
    AND m.status = 'active'
    AND m.role <> 'sponsor'
    AND p.role = 'student'
    AND p.account_status = 'active'
  ORDER BY COALESCE(p.full_name, ''), p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.grade_club_assignment_submission(
  submission_uuid UUID,
  awarded_points NUMERIC,
  grader_feedback TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  target_submission public.club_assignment_submissions%ROWTYPE;
  target_assignment public.club_assignments%ROWTYPE;
  normalized_feedback TEXT := NULLIF(BTRIM(grader_feedback), '');
BEGIN
  SELECT * INTO target_submission FROM public.club_assignment_submissions WHERE id = submission_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  SELECT * INTO target_assignment FROM public.club_assignments WHERE id = target_submission.assignment_id;
  IF NOT public.can_grade_club_coursework(target_assignment.club_id) THEN
    RAISE EXCEPTION 'Only the club Advisor or an administrator can grade submissions';
  END IF;
  IF awarded_points IS NULL OR awarded_points < 0 OR awarded_points > target_assignment.points_possible THEN
    RAISE EXCEPTION 'Grade must be between 0 and the points possible';
  END IF;
  IF normalized_feedback IS NOT NULL AND char_length(normalized_feedback) > 10000 THEN
    RAISE EXCEPTION 'Feedback is too long';
  END IF;
  UPDATE public.club_assignment_submissions SET
    grade_points = awarded_points,
    feedback = normalized_feedback,
    graded_by = auth.uid(),
    graded_at = NOW(),
    status = 'returned'
  WHERE id = submission_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Presidents can publish announcements and resources; club events always require
-- adult approval. Vice Presidents may create pending content but cannot approve it.
CREATE OR REPLACE FUNCTION public.enforce_content_approval()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  SELECT role INTO actor_role FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';
  content_club_id := NEW.club_id;
  IF actor_role IN ('admin', 'super_admin') THEN RETURN NEW; END IF;
  IF content_club_id IS NOT NULL AND public.is_club_advisor(content_club_id) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('club_announcements', 'club_resources')
    AND content_club_id IS NOT NULL
    AND public.is_club_president(content_club_id)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This content requires approval from an authorized club leader';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Advisors may pause/archive their own club, but only school administrators can
-- move clubs between schools or control the platform-wide featured flag.
CREATE OR REPLACE FUNCTION public.enforce_club_publication_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
BEGIN
  IF NEW.school_id IS NOT DISTINCT FROM OLD.school_id
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.visibility IS NOT DISTINCT FROM OLD.visibility
    AND NEW.is_listed IS NOT DISTINCT FROM OLD.is_listed
    AND NEW.is_featured IS NOT DISTINCT FROM OLD.is_featured
    AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
  THEN RETURN NEW; END IF;
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  SELECT role, school_id INTO actor_role, actor_school_id
  FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';
  IF actor_role = 'super_admin' THEN RETURN NEW; END IF;
  IF actor_role = 'admin'
    AND actor_school_id = OLD.school_id
    AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id
  THEN RETURN NEW; END IF;
  IF public.is_club_advisor(OLD.id)
    AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id
    AND NEW.is_featured IS NOT DISTINCT FROM OLD.is_featured
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Only a school administrator can change this club publication setting';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS clubs_enforce_publication_permissions ON public.clubs;
CREATE TRIGGER clubs_enforce_publication_permissions
  BEFORE UPDATE OF school_id, status, visibility, is_listed, is_featured, is_active ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_publication_permissions();

CREATE TABLE IF NOT EXISTS public.club_event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_event_attendance_event
  ON public.club_event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_attendance_user
  ON public.club_event_attendance(user_id);
ALTER TABLE public.club_event_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_event_attendance FROM anon, authenticated;
GRANT ALL ON TABLE public.club_event_attendance TO service_role;

CREATE OR REPLACE FUNCTION public.get_club_event_attendance(event_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  membership_role TEXT,
  rsvp_status TEXT,
  attendance_status TEXT,
  marked_at TIMESTAMPTZ
) AS $$
DECLARE
  target_club_id UUID;
BEGIN
  SELECT club_id INTO target_club_id FROM public.events WHERE id = event_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Club event not found'; END IF;
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Club member'),
    m.role,
    r.status,
    a.status,
    a.marked_at
  FROM public.club_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.event_rsvps r ON r.event_id = event_uuid AND r.user_id = m.user_id
  LEFT JOIN public.club_event_attendance a ON a.event_id = event_uuid AND a.user_id = m.user_id
  WHERE m.club_id = target_club_id
    AND m.status = 'active'
    AND m.role <> 'sponsor'
    AND p.role = 'student'
    AND p.account_status = 'active'
  ORDER BY COALESCE(p.full_name, ''), p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_club_event_attendance(
  event_uuid UUID,
  target_user_id UUID,
  attendance_value TEXT
)
RETURNS VOID AS $$
DECLARE
  target_club_id UUID;
BEGIN
  SELECT club_id INTO target_club_id FROM public.events WHERE id = event_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Club event not found'; END IF;
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = target_club_id
      AND m.user_id = target_user_id
      AND m.status = 'active'
      AND m.role <> 'sponsor'
      AND p.role = 'student'
  ) THEN RAISE EXCEPTION 'Student is not an active club member'; END IF;

  IF attendance_value IS NULL OR attendance_value = '' THEN
    DELETE FROM public.club_event_attendance
    WHERE event_id = event_uuid AND user_id = target_user_id;
    RETURN;
  END IF;
  IF attendance_value NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'Invalid attendance status';
  END IF;
  INSERT INTO public.club_event_attendance (event_id, user_id, status, marked_by)
  VALUES (event_uuid, target_user_id, attendance_value, auth.uid())
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_club_assignment_submission_statuses(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_assignment_submission_statuses(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_club_event_attendance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_event_attendance(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.set_club_event_attendance(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_club_event_attendance(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION
  public.is_club_advisor(UUID),
  public.is_club_president(UUID),
  public.is_club_vice_president(UUID),
  public.can_manage_club_roster(UUID),
  public.can_create_club_coursework(UUID),
  public.can_publish_club_coursework(UUID),
  public.can_grade_club_coursework(UUID),
  public.can_track_club_submissions(UUID),
  public.can_manage_club_coursework(UUID)
TO authenticated, service_role;

COMMIT;
