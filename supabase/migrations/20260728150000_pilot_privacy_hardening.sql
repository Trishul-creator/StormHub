-- Pilot privacy hardening:
-- 1. Require a school-specific access code for every new school account.
-- 2. Make platform access to private coursework temporary, read-only, and auditable.
-- 3. Minimize student names in the peer-facing club directory.
-- 4. Add durable records for automated data-retention runs.

BEGIN;

-- School access codes are deliberately kept outside the publicly readable
-- schools table. Application server actions use the service role to reveal or
-- rotate a code after independently verifying the administrator.
CREATE TABLE IF NOT EXISTS public.school_signup_access (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  access_code TEXT NOT NULL UNIQUE,
  rotated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (access_code ~ '^SH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$')
);

ALTER TABLE public.school_signup_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_signup_access FROM anon, authenticated;
GRANT ALL ON TABLE public.school_signup_access TO service_role;

CREATE OR REPLACE FUNCTION public.generate_school_signup_code()
RETURNS TEXT AS $$
DECLARE
  token TEXT := upper(replace(gen_random_uuid()::TEXT, '-', ''));
BEGIN
  RETURN 'SH-' || substr(token, 1, 4) || '-' || substr(token, 5, 4) || '-' || substr(token, 9, 4);
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

REVOKE ALL ON FUNCTION public.generate_school_signup_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_school_signup_code() TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_school_signup_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.school_signup_access (school_id, access_code)
  VALUES (NEW.id, public.generate_school_signup_code())
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS schools_ensure_signup_access ON public.schools;
CREATE TRIGGER schools_ensure_signup_access
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.ensure_school_signup_access();

INSERT INTO public.school_signup_access (school_id, access_code)
SELECT school.id, public.generate_school_signup_code()
FROM public.schools school
ON CONFLICT (school_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_school_signup_code(
  target_school_id UUID,
  candidate_code TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_signup_access access
    WHERE access.school_id = target_school_id
      AND access.access_code = upper(trim(COALESCE(candidate_code, '')))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.verify_school_signup_code(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_school_signup_code(UUID, TEXT) TO service_role;

-- Keep Google identities at the incomplete-profile checkpoint, while requiring
-- both the selected school's domain rule and its private code for password signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
  permitted_domains TEXT[];
  raw_school_id TEXT;
  raw_grade TEXT;
  raw_access_code TEXT;
  email_domain TEXT;
  parsed_grade INT;
  is_google_provider BOOLEAN;
BEGIN
  raw_school_id := NEW.raw_user_meta_data->>'school_id';
  raw_access_code := NEW.raw_user_meta_data->>'school_access_code';
  is_google_provider :=
    lower(COALESCE(NEW.raw_app_meta_data->>'provider', '')) = 'google'
    OR COALESCE(NEW.raw_app_meta_data->'providers', '[]'::JSONB) ? 'google';

  IF raw_school_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, allowed_email_domains
    INTO target_school_id, permitted_domains
    FROM public.schools
    WHERE id = raw_school_id::UUID
      AND is_active = TRUE
      AND is_public = TRUE
    LIMIT 1;

    IF target_school_id IS NULL THEN
      RAISE EXCEPTION 'Choose an active school workspace';
    END IF;

    IF NOT public.verify_school_signup_code(target_school_id, raw_access_code) THEN
      RAISE EXCEPTION 'Enter the correct school access code';
    END IF;

    IF COALESCE(cardinality(permitted_domains), 0) = 0 THEN
      RAISE EXCEPTION 'Signups are not configured for this school';
    END IF;

    email_domain := lower(split_part(COALESCE(NEW.email, ''), '@', 2));
    IF NOT EXISTS (
      SELECT 1
      FROM unnest(permitted_domains) AS domain(value)
      WHERE trim(domain.value) = '*'
        OR lower(trim(domain.value)) = email_domain
    ) THEN
      RAISE EXCEPTION 'Use an approved school email address';
    END IF;

    raw_grade := NEW.raw_user_meta_data->>'grade_level';
    IF raw_grade ~ '^[0-9]+$' THEN
      parsed_grade := raw_grade::INT;
    END IF;
    IF parsed_grade NOT BETWEEN 9 AND 12 THEN
      parsed_grade := NULL;
    END IF;

    INSERT INTO public.profiles (
      id, email, full_name, role, school_id, grade_level,
      account_status, created_at, updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'New user'),
      'student',
      target_school_id,
      parsed_grade,
      'active',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
  END IF;

  IF NOT is_google_provider THEN
    RAISE EXCEPTION 'Choose a valid school workspace';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, grade_level,
    account_status, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NEW.email,
      'New user'
    ),
    'student',
    NULL,
    NULL,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Platform support sessions make private-data access explicit and short-lived.
CREATE TABLE IF NOT EXISTS public.platform_support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CHECK (expires_at > started_at),
  CHECK (expires_at <= started_at + INTERVAL '60 minutes')
);

CREATE INDEX IF NOT EXISTS idx_platform_support_sessions_active
  ON public.platform_support_sessions(actor_user_id, school_id, expires_at DESC)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS public.platform_support_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.platform_support_sessions(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('start', 'view', 'download', 'end')),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_support_access_log_school
  ON public.platform_support_access_log(school_id, occurred_at DESC);

ALTER TABLE public.platform_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_support_sessions, public.platform_support_access_log
  FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_support_sessions, public.platform_support_access_log
  TO service_role;

CREATE OR REPLACE FUNCTION public.has_active_platform_support_access(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_support_sessions session
    JOIN public.profiles actor ON actor.id = session.actor_user_id
    WHERE session.actor_user_id = auth.uid()
      AND session.school_id = target_school_id
      AND session.ended_at IS NULL
      AND session.expires_at > NOW()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.has_active_platform_support_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_platform_support_access(UUID) TO authenticated, service_role;

-- Grading remains with the Advisor and scoped school administrators. Platform
-- support may read during an active session but cannot grade.
CREATE OR REPLACE FUNCTION public.can_grade_club_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_club_advisor(club_uuid)
    OR EXISTS (
      SELECT 1
      FROM public.profiles actor
      JOIN public.clubs club ON club.id = club_uuid
      WHERE actor.id = auth.uid()
        AND actor.role = 'admin'
        AND actor.account_status = 'active'
        AND actor.school_id = club.school_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_private_coursework(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_grade_club_coursework(club_uuid)
    OR EXISTS (
      SELECT 1
      FROM public.clubs club
      WHERE club.id = club_uuid
        AND public.has_active_platform_support_access(club.school_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_read_private_coursework(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_private_coursework(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "assignment_submissions_read" ON public.club_assignment_submissions;
CREATE POLICY "assignment_submissions_read" ON public.club_assignment_submissions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments assignment
      WHERE assignment.id = assignment_id
        AND public.can_read_private_coursework(assignment.club_id)
    )
  );

DROP POLICY IF EXISTS "submission_attachments_read" ON public.club_submission_attachments;
CREATE POLICY "submission_attachments_read" ON public.club_submission_attachments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments assignment
      WHERE assignment.id = assignment_id
        AND public.can_read_private_coursework(assignment.club_id)
    )
  );

DROP POLICY IF EXISTS "student_copies_read" ON public.club_assignment_student_copies;
CREATE POLICY "student_copies_read" ON public.club_assignment_student_copies FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_assignments assignment
      WHERE assignment.id = assignment_id
        AND public.can_read_private_coursework(assignment.club_id)
    )
  );

-- Ordinary members see enough information to identify their peers without
-- exposing complete student names. Roster managers retain full names.
CREATE OR REPLACE FUNCTION public.privacy_safe_member_name(value TEXT)
RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  normalized TEXT := regexp_replace(BTRIM(COALESCE(value, '')), '\s+', ' ', 'g');
BEGIN
  IF normalized = '' THEN RETURN 'Club member'; END IF;
  parts := string_to_array(normalized, ' ');
  IF cardinality(parts) < 2 THEN RETURN normalized; END IF;
  RETURN parts[1] || ' ' || left(parts[cardinality(parts)], 1) || '.';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_club_member_directory(club_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  membership_role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
DECLARE
  can_view_full_names BOOLEAN;
  actor_role TEXT;
BEGIN
  IF NOT (
    public.is_club_member(club_uuid)
    OR public.can_manage_club(club_uuid)
    OR public.can_manage_club_coursework(club_uuid)
  ) THEN
    RAISE EXCEPTION 'Club membership required';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  can_view_full_names :=
    (actor_role IS DISTINCT FROM 'super_admin' AND public.can_manage_club_roster(club_uuid))
    OR public.can_grade_club_coursework(club_uuid)
    OR EXISTS (
      SELECT 1 FROM public.clubs club
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
    membership.role,
    membership.joined_at
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
  target_school_id UUID;
  actor_role TEXT;
BEGIN
  SELECT assignment.club_id, club.school_id
  INTO target_club_id, target_school_id
  FROM public.club_assignments assignment
  JOIN public.clubs club ON club.id = assignment.club_id
  WHERE assignment.id = assignment_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF NOT public.can_track_club_submissions(target_club_id) THEN
    RAISE EXCEPTION 'Club leadership access required';
  END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role = 'super_admin'
    AND NOT public.has_active_platform_support_access(target_school_id)
  THEN
    RAISE EXCEPTION 'Start a school support session to view student submission status';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    COALESCE(NULLIF(BTRIM(profile.full_name), ''), 'Club member'),
    profile.avatar_url,
    membership.role,
    submission.id,
    submission.status,
    submission.submitted_at,
    submission.graded_at
  FROM public.club_memberships membership
  JOIN public.profiles profile ON profile.id = membership.user_id
  LEFT JOIN public.club_assignment_submissions submission
    ON submission.assignment_id = assignment_uuid
    AND submission.student_id = membership.user_id
  WHERE membership.club_id = target_club_id
    AND membership.status = 'active'
    AND membership.role <> 'sponsor'
    AND profile.role = 'student'
    AND profile.account_status = 'active'
  ORDER BY COALESCE(profile.full_name, ''), profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

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
  target_school_id UUID;
  actor_role TEXT;
BEGIN
  SELECT event.club_id, event.school_id
  INTO target_club_id, target_school_id
  FROM public.events event
  WHERE event.id = event_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Club event not found'; END IF;
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role = 'super_admin'
    AND NOT public.has_active_platform_support_access(target_school_id)
  THEN
    RAISE EXCEPTION 'Start a school support session to view student attendance';
  END IF;
  RETURN QUERY
  SELECT
    profile.id,
    COALESCE(NULLIF(BTRIM(profile.full_name), ''), 'Club member'),
    membership.role,
    rsvp.status,
    attendance.status,
    attendance.marked_at
  FROM public.club_memberships membership
  JOIN public.profiles profile ON profile.id = membership.user_id
  LEFT JOIN public.event_rsvps rsvp
    ON rsvp.event_id = event_uuid AND rsvp.user_id = membership.user_id
  LEFT JOIN public.club_event_attendance attendance
    ON attendance.event_id = event_uuid AND attendance.user_id = membership.user_id
  WHERE membership.club_id = target_club_id
    AND membership.status = 'active'
    AND membership.role <> 'sponsor'
    AND profile.role = 'student'
    AND profile.account_status = 'active'
  ORDER BY COALESCE(profile.full_name, ''), profile.id;
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
  actor_role TEXT;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role = 'super_admin' THEN
    RAISE EXCEPTION 'Platform support access is read-only';
  END IF;
  SELECT club_id INTO target_club_id FROM public.events WHERE id = event_uuid;
  IF target_club_id IS NULL THEN RAISE EXCEPTION 'Club event not found'; END IF;
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Club Vice President, Advisor, or administrator access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.club_memberships membership
    JOIN public.profiles profile ON profile.id = membership.user_id
    WHERE membership.club_id = target_club_id
      AND membership.user_id = target_user_id
      AND membership.status = 'active'
      AND membership.role <> 'sponsor'
      AND profile.role = 'student'
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

-- Retention records and reliable feedback resolution timestamps.
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

UPDATE public.feedback
SET resolved_at = COALESCE(resolved_at, created_at)
WHERE status = 'resolved' AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_feedback_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := NOW();
  ELSIF NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS feedback_set_resolved_at ON public.feedback;
CREATE TRIGGER feedback_set_resolved_at
  BEFORE UPDATE OF status ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_feedback_resolved_at();

CREATE TABLE IF NOT EXISTS public.data_retention_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  deleted_counts JSONB NOT NULL DEFAULT '{}',
  error_message TEXT
);

ALTER TABLE public.data_retention_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.data_retention_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.data_retention_runs TO service_role;

COMMIT;
