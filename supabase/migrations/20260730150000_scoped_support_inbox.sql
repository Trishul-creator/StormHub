-- Keep support-message content inside an explicit school scope.
--
-- School administrators may review and respond for their assigned school.
-- District administrators may review schools in their assigned district.
-- Platform administrators may only read during a recorded, time-limited
-- support session for the exact school, and that access remains read-only.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_review_school_feedback(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    LEFT JOIN public.schools school ON school.id = target_school_id
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        (
          actor.role = 'admin'
          AND actor.school_id = target_school_id
        )
        OR (
          actor.role = 'district_admin'
          AND actor.district_id IS NOT NULL
          AND actor.district_id = school.district_id
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_school_feedback(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_review_school_feedback(target_school_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'super_admin'
        AND actor.account_status = 'active'
        AND public.has_active_platform_support_access(target_school_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_review_school_feedback(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_school_feedback(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_school_feedback(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_school_feedback(UUID)
  TO authenticated, service_role;

DROP POLICY IF EXISTS "feedback_admin_read" ON public.feedback;
CREATE POLICY "feedback_admin_read"
  ON public.feedback FOR SELECT TO authenticated
  USING (public.can_read_school_feedback(school_id));

DROP POLICY IF EXISTS "feedback_admin_update" ON public.feedback;
REVOKE UPDATE ON TABLE public.feedback FROM authenticated;

CREATE OR REPLACE FUNCTION public.review_feedback_status(
  target_feedback_id UUID,
  target_school_id UUID,
  next_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  actor_role TEXT;
  affected_rows INTEGER;
BEGIN
  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = auth.uid()
    AND account_status = 'active';

  IF actor_role = 'super_admin' THEN
    RAISE EXCEPTION 'Platform support access is read-only';
  END IF;
  IF NOT public.can_review_school_feedback(target_school_id) THEN
    RAISE EXCEPTION 'School or district administrator access required';
  END IF;
  IF next_status NOT IN ('open', 'reviewed', 'resolved') THEN
    RAISE EXCEPTION 'Invalid feedback status';
  END IF;

  UPDATE public.feedback
  SET status = next_status
  WHERE id = target_feedback_id
    AND school_id = target_school_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_feedback_status(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_feedback_status(UUID, UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_review_school_feedback(UUID) IS
  'School and district administrators may manage feedback only inside their assigned scope.';
COMMENT ON FUNCTION public.can_read_school_feedback(UUID) IS
  'Adds read-only platform access only while an active support session exists for the exact school.';
COMMENT ON FUNCTION public.review_feedback_status(UUID, UUID, TEXT) IS
  'Changes only workflow status after validating the exact school scope; message content cannot be edited by client roles.';
COMMENT ON POLICY "feedback_admin_read" ON public.feedback IS
  'No global support inbox: school/district scope or a school-specific platform support session is required.';

COMMIT;
