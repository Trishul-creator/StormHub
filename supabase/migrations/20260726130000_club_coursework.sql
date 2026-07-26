BEGIN;

CREATE TABLE IF NOT EXISTS public.club_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  instructions TEXT NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 20000),
  due_at TIMESTAMPTZ,
  points_possible NUMERIC(8, 2) NOT NULL DEFAULT 100
    CHECK (points_possible >= 0 AND points_possible <= 10000),
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.club_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES public.club_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_text TEXT CHECK (char_length(submission_text) <= 20000),
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'returned')),
  submitted_at TIMESTAMPTZ,
  grade_points NUMERIC(8, 2) CHECK (grade_points >= 0),
  feedback TEXT CHECK (char_length(feedback) <= 10000),
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_club_assignments_club_due
  ON public.club_assignments(club_id, due_at);
CREATE INDEX IF NOT EXISTS idx_club_assignments_status
  ON public.club_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
  ON public.club_assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student
  ON public.club_assignment_submissions(student_id);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'club_announcement', 'club_event_created', 'club_event_updated',
    'club_event_canceled', 'club_assignment_created', 'club_assignment_graded',
    'club_opportunity_created', 'opportunity_deadline_soon', 'approval_needed',
    'content_approved', 'content_rejected', 'system_message'
  ));

DROP TRIGGER IF EXISTS club_assignments_updated_at ON public.club_assignments;
CREATE TRIGGER club_assignments_updated_at
  BEFORE UPDATE ON public.club_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS club_assignment_submissions_updated_at ON public.club_assignment_submissions;
CREATE TRIGGER club_assignment_submissions_updated_at
  BEFORE UPDATE ON public.club_assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid) OR EXISTS (
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

CREATE OR REPLACE FUNCTION public.get_club_member_directory(club_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  membership_role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT (
    public.is_club_member(club_uuid)
    OR public.can_manage_club(club_uuid)
    OR public.can_manage_club_coursework(club_uuid)
  ) THEN
    RAISE EXCEPTION 'Club membership required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Club member'),
    p.avatar_url,
    m.role,
    m.joined_at
  FROM public.club_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.club_id = club_uuid
    AND m.status = 'active'
    AND p.account_status = 'active'
  ORDER BY
    CASE m.role
      WHEN 'sponsor' THEN 1
      WHEN 'president' THEN 2
      WHEN 'officer' THEN 3
      ELSE 4
    END,
    COALESCE(p.full_name, ''),
    p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.submit_club_assignment(
  assignment_uuid UUID,
  submitted_text TEXT DEFAULT NULL,
  submitted_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  target_assignment public.club_assignments%ROWTYPE;
  actor_role TEXT;
  normalized_text TEXT := NULLIF(BTRIM(submitted_text), '');
  normalized_url TEXT := NULLIF(BTRIM(submitted_url), '');
  submission_uuid UUID;
BEGIN
  SELECT * INTO target_assignment
  FROM public.club_assignments
  WHERE id = assignment_uuid;

  IF NOT FOUND OR target_assignment.status <> 'published' THEN
    RAISE EXCEPTION 'This assignment is not accepting submissions';
  END IF;

  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';

  IF actor_role <> 'student' OR NOT public.is_club_member(target_assignment.club_id) THEN
    RAISE EXCEPTION 'An active student club membership is required';
  END IF;

  IF normalized_text IS NULL AND normalized_url IS NULL THEN
    RAISE EXCEPTION 'Add a response or submission link';
  END IF;

  IF normalized_text IS NOT NULL AND char_length(normalized_text) > 20000 THEN
    RAISE EXCEPTION 'Submission text is too long';
  END IF;

  IF normalized_url IS NOT NULL AND normalized_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Submission link must use http or https';
  END IF;

  INSERT INTO public.club_assignment_submissions (
    assignment_id,
    student_id,
    submission_text,
    attachment_url,
    status,
    submitted_at
  ) VALUES (
    target_assignment.id,
    auth.uid(),
    normalized_text,
    normalized_url,
    'submitted',
    NOW()
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    submission_text = EXCLUDED.submission_text,
    attachment_url = EXCLUDED.attachment_url,
    status = 'submitted',
    submitted_at = NOW(),
    grade_points = NULL,
    feedback = NULL,
    graded_by = NULL,
    graded_at = NULL
  RETURNING id INTO submission_uuid;

  RETURN submission_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  SELECT * INTO target_submission
  FROM public.club_assignment_submissions
  WHERE id = submission_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  SELECT * INTO target_assignment
  FROM public.club_assignments
  WHERE id = target_submission.assignment_id;

  IF NOT public.can_manage_club_coursework(target_assignment.club_id) THEN
    RAISE EXCEPTION 'Teacher sponsor or administrator access required';
  END IF;

  IF awarded_points IS NULL
    OR awarded_points < 0
    OR awarded_points > target_assignment.points_possible THEN
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

ALTER TABLE public.club_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_read" ON public.club_assignments;
CREATE POLICY "assignments_read" ON public.club_assignments FOR SELECT TO authenticated
  USING (
    (status IN ('published', 'closed') AND public.is_club_member(club_id))
    OR public.can_manage_club_coursework(club_id)
  );

DROP POLICY IF EXISTS "assignments_manage" ON public.club_assignments;
CREATE POLICY "assignments_manage" ON public.club_assignments FOR ALL TO authenticated
  USING (public.can_manage_club_coursework(club_id))
  WITH CHECK (public.can_manage_club_coursework(club_id));

DROP POLICY IF EXISTS "active_authenticated_account" ON public.club_assignments;
CREATE POLICY "active_authenticated_account" ON public.club_assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "assignment_submissions_read" ON public.club_assignment_submissions;
CREATE POLICY "assignment_submissions_read" ON public.club_assignment_submissions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_assignments a
      WHERE a.id = assignment_id
        AND public.can_manage_club_coursework(a.club_id)
    )
  );

DROP POLICY IF EXISTS "active_authenticated_account" ON public.club_assignment_submissions;
CREATE POLICY "active_authenticated_account" ON public.club_assignment_submissions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

GRANT SELECT, INSERT, UPDATE ON TABLE public.club_assignments TO authenticated;
GRANT SELECT ON TABLE public.club_assignment_submissions TO authenticated;
GRANT ALL ON TABLE public.club_assignments, public.club_assignment_submissions TO service_role;

REVOKE ALL ON FUNCTION public.can_manage_club_coursework(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_club_coursework(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_club_member_directory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_member_directory(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_club_assignment(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_club_assignment(UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.grade_club_assignment_submission(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_club_assignment_submission(UUID, NUMERIC, TEXT) TO authenticated;

COMMIT;
