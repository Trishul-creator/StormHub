-- Support and tenant offboarding are platform-owner responsibilities. Enforce
-- that boundary in database helpers and RPCs as well as in application routes.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_review_school_feedback(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_school_feedback(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_review_school_feedback(target_school_id);
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
  affected_rows INTEGER;
BEGIN
  IF NOT public.can_review_school_feedback(target_school_id) THEN
    RAISE EXCEPTION 'Platform administrator access required';
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

CREATE OR REPLACE FUNCTION public.can_read_tenant_offboarding(
  target_district_id UUID,
  target_school_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_review_tenant_offboarding(
  target_scope_type TEXT,
  target_district_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_read_tenant_offboarding(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_review_tenant_offboarding(TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_tenant_offboarding(UUID, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_tenant_offboarding(TEXT, UUID)
  TO authenticated, service_role;

-- Retain the already-audited state machines behind platform-only wrappers.
ALTER FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  RENAME TO submit_tenant_offboarding_request_scoped_internal;
REVOKE ALL ON FUNCTION public.submit_tenant_offboarding_request_scoped_internal(TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.submit_tenant_offboarding_request(
  requested_scope_type TEXT,
  requested_scope_id UUID,
  requested_reason TEXT
)
RETURNS UUID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active platform administrator access required';
  END IF;

  RETURN public.submit_tenant_offboarding_request_scoped_internal(
    requested_scope_type,
    requested_scope_id,
    requested_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) RENAME TO review_tenant_offboarding_request_scoped_internal;
REVOKE ALL ON FUNCTION public.review_tenant_offboarding_request_scoped_internal(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.review_tenant_offboarding_request(
  target_request_id UUID,
  next_status TEXT,
  requested_reviewer_notes TEXT DEFAULT NULL,
  requested_export_reference TEXT DEFAULT NULL,
  requested_scheduled_purge_at TIMESTAMPTZ DEFAULT NULL,
  requested_completion_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active platform administrator access required';
  END IF;

  RETURN public.review_tenant_offboarding_request_scoped_internal(
    target_request_id,
    next_status,
    requested_reviewer_notes,
    requested_export_reference,
    requested_scheduled_purge_at,
    requested_completion_reference
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  RENAME TO cancel_tenant_offboarding_request_scoped_internal;
REVOKE ALL ON FUNCTION public.cancel_tenant_offboarding_request_scoped_internal(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.cancel_tenant_offboarding_request(
  target_request_id UUID,
  cancellation_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'super_admin'
      AND actor.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active platform administrator access required';
  END IF;

  RETURN public.cancel_tenant_offboarding_request_scoped_internal(
    target_request_id,
    cancellation_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_review_school_feedback(UUID) IS
  'Only active platform administrators may review submitted support tickets.';
COMMENT ON FUNCTION public.can_read_school_feedback(UUID) IS
  'Only active platform administrators may read submitted support tickets.';
COMMENT ON POLICY "feedback_admin_read" ON public.feedback IS
  'Support inbox content is restricted to active platform administrators.';
COMMENT ON FUNCTION public.can_read_tenant_offboarding(UUID, UUID) IS
  'Only active platform administrators may read tenant offboarding records.';
COMMENT ON FUNCTION public.can_review_tenant_offboarding(TEXT, UUID) IS
  'Only active platform administrators may review tenant offboarding records.';
COMMENT ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT) IS
  'Platform-only wrapper for the audited tenant offboarding request workflow.';
COMMENT ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) IS 'Platform-only wrapper for reviewing and scheduling tenant offboarding.';
COMMENT ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT) IS
  'Platform-only wrapper for cancelling or restoring tenant offboarding.';

COMMIT;
