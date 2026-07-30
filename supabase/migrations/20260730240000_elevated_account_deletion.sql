-- Make account-deletion requests safe for district and platform administrators.
-- Request scope is derived from the authenticated profile, retained as an
-- immutable audit snapshot, and reviewed by an independent higher-scope actor.

BEGIN;

ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS target_user_id_snapshot UUID,
  ADD COLUMN IF NOT EXISTS requester_role TEXT,
  ADD COLUMN IF NOT EXISTS scope_type TEXT,
  ADD COLUMN IF NOT EXISTS district_id UUID;

-- A deletion request is audit evidence. Do not erase its school scope when a
-- school is later removed by a verified tenant-offboarding workflow.
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_school_id_fkey;

-- Preserve the best available scope for requests created by older releases.
UPDATE public.account_deletion_requests request
SET target_user_id_snapshot = request.user_id,
    requester_role = profile.role,
    scope_type = CASE
      WHEN profile.role = 'super_admin' THEN 'platform'
      WHEN profile.role = 'district_admin' THEN 'district'
      ELSE 'school'
    END,
    school_id = CASE
      WHEN profile.role IN ('district_admin', 'super_admin') THEN NULL
      ELSE COALESCE(request.school_id, profile.school_id)
    END,
    district_id = CASE
      WHEN profile.role = 'super_admin' THEN NULL
      WHEN profile.role = 'district_admin' THEN profile.district_id
      ELSE COALESCE(
        profile.district_id,
        (
          SELECT school.district_id
          FROM public.schools school
          WHERE school.id = COALESCE(request.school_id, profile.school_id)
        )
      )
    END
FROM public.profiles profile
WHERE request.user_id = profile.id
  AND request.target_user_id_snapshot IS NULL;

-- An orphaned legacy request cannot be independently reviewed because its
-- target identity and role are already gone. Close it instead of weakening the
-- snapshot invariants required for every live request.
UPDATE public.account_deletion_requests
SET status = 'rejected',
    reviewed_at = COALESCE(reviewed_at, NOW()),
    reviewer_notes = COALESCE(
      reviewer_notes,
      'Automatically closed during the account-deletion security upgrade because the target account no longer exists.'
    )
WHERE status IN ('pending', 'approved')
  AND target_user_id_snapshot IS NULL;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_snapshot_role_check,
  DROP CONSTRAINT IF EXISTS account_deletion_requests_snapshot_scope_check,
  DROP CONSTRAINT IF EXISTS account_deletion_requests_live_snapshot_check,
  DROP CONSTRAINT IF EXISTS account_deletion_requests_target_identity_check;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_snapshot_role_check
  CHECK (
    requester_role IS NULL
    OR requester_role IN (
      'student', 'teacher', 'admin', 'district_admin', 'super_admin'
    )
  ),
  ADD CONSTRAINT account_deletion_requests_snapshot_scope_check
  CHECK (
    target_user_id_snapshot IS NULL
    OR (
      requester_role IN ('student', 'teacher', 'admin')
      AND scope_type = 'school'
      AND school_id IS NOT NULL
    )
    OR (
      requester_role = 'district_admin'
      AND scope_type = 'district'
      AND school_id IS NULL
      AND district_id IS NOT NULL
    )
    OR (
      requester_role = 'super_admin'
      AND scope_type = 'platform'
      AND school_id IS NULL
      AND district_id IS NULL
    )
  ),
  ADD CONSTRAINT account_deletion_requests_live_snapshot_check
  CHECK (
    status NOT IN ('pending', 'approved')
    OR (
      target_user_id_snapshot IS NOT NULL
      AND requester_role IS NOT NULL
      AND scope_type IS NOT NULL
    )
  ),
  ADD CONSTRAINT account_deletion_requests_target_identity_check
  CHECK (
    user_id IS NULL
    OR target_user_id_snapshot IS NULL
    OR user_id = target_user_id_snapshot
  );

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_target_status
  ON public.account_deletion_requests(
    target_user_id_snapshot,
    status,
    requested_at DESC
  );
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_district_status
  ON public.account_deletion_requests(district_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_platform_status
  ON public.account_deletion_requests(status, requested_at DESC)
  WHERE scope_type = 'platform';

CREATE OR REPLACE FUNCTION public.protect_account_deletion_request_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_user_id_snapshot IS DISTINCT FROM OLD.target_user_id_snapshot
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.district_id IS DISTINCT FROM OLD.district_id
    OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
    OR NEW.requester_role IS DISTINCT FROM OLD.requester_role
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
  THEN
    RAISE EXCEPTION 'Account deletion request scope and request details are immutable';
  END IF;

  -- auth.users deletion cascades through profiles and must be able to null the
  -- legacy live reference. It may never be reassigned to another identity.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    AND NOT (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL)
  THEN
    RAISE EXCEPTION 'Account deletion request identity is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS account_deletion_requests_protect_snapshot
  ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_protect_snapshot
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_deletion_request_snapshot();

CREATE OR REPLACE FUNCTION public.submit_account_deletion_request(
  requested_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  canonical_district_id UUID;
  derived_scope_type TEXT;
  derived_school_id UUID;
  new_request_id UUID;
  normalized_reason TEXT;
BEGIN
  SELECT *
  INTO actor
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF actor.id IS NULL OR actor.account_status <> 'active' THEN
    RAISE EXCEPTION 'An active authenticated account is required';
  END IF;

  IF actor.role NOT IN (
    'student', 'teacher', 'admin', 'district_admin', 'super_admin'
  ) THEN
    RAISE EXCEPTION 'The account role cannot request deletion';
  END IF;

  canonical_district_id := actor.district_id;
  IF actor.school_id IS NOT NULL THEN
    SELECT COALESCE(actor.district_id, school.district_id)
    INTO canonical_district_id
    FROM public.schools school
    WHERE school.id = actor.school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The account school no longer exists';
    END IF;
  END IF;

  IF actor.role IN ('student', 'teacher', 'admin') THEN
    IF actor.school_id IS NULL THEN
      RAISE EXCEPTION 'The account must be assigned to a school';
    END IF;
    derived_scope_type := 'school';
    derived_school_id := actor.school_id;
  ELSIF actor.role = 'district_admin' THEN
    IF canonical_district_id IS NULL THEN
      RAISE EXCEPTION 'The district administrator must be assigned to a district';
    END IF;
    derived_scope_type := 'district';
    derived_school_id := NULL;
  ELSE
    derived_scope_type := 'platform';
    derived_school_id := NULL;
    canonical_district_id := NULL;
  END IF;

  normalized_reason := NULLIF(LEFT(BTRIM(COALESCE(requested_reason, '')), 1000), '');

  INSERT INTO public.account_deletion_requests (
    user_id,
    target_user_id_snapshot,
    requester_role,
    scope_type,
    school_id,
    district_id,
    reason
  ) VALUES (
    actor.id,
    actor.id,
    actor.role,
    derived_scope_type,
    derived_school_id,
    canonical_district_id,
    normalized_reason
  )
  RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.can_review_account_deletion_request(
  target_request_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_deletion_requests request
    JOIN public.profiles actor ON actor.id = auth.uid()
    WHERE request.id = target_request_id
      AND actor.account_status = 'active'
      AND actor.id IS DISTINCT FROM request.target_user_id_snapshot
      AND (
        (
          request.requester_role IN ('student', 'teacher')
          AND (
            (
              actor.role = 'admin'
              AND actor.school_id = request.school_id
            )
            OR (
              actor.role = 'district_admin'
              AND actor.district_id IS NOT NULL
              AND actor.district_id = request.district_id
            )
            OR actor.role = 'super_admin'
          )
        )
        OR (
          request.requester_role = 'admin'
          AND (
            (
              actor.role = 'district_admin'
              AND actor.district_id IS NOT NULL
              AND actor.district_id = request.district_id
            )
            OR actor.role = 'super_admin'
          )
        )
        OR (
          request.requester_role = 'district_admin'
          AND actor.role = 'super_admin'
        )
        OR (
          request.requester_role = 'super_admin'
          AND actor.role = 'super_admin'
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.review_account_deletion_request(
  target_request_id UUID,
  requested_decision TEXT,
  requested_notes TEXT DEFAULT NULL
)
RETURNS TABLE(request_id UUID, target_user_id UUID, status TEXT) AS $$
DECLARE
  request_record public.account_deletion_requests%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
  canonical_district_id UUID;
  next_status TEXT;
  normalized_notes TEXT;
BEGIN
  IF requested_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Choose approve or reject';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:elevated-account-deletion', 0)
  );

  SELECT *
  INTO request_record
  FROM public.account_deletion_requests request
  WHERE request.id = target_request_id
  FOR UPDATE;

  IF request_record.id IS NULL THEN
    RAISE EXCEPTION 'Account deletion request not found';
  END IF;
  IF request_record.status <> 'pending' THEN
    RAISE EXCEPTION 'This account deletion request has already been reviewed';
  END IF;
  IF request_record.target_user_id_snapshot IS NULL THEN
    RAISE EXCEPTION 'The requested account no longer exists';
  END IF;
  IF auth.uid() IS NOT DISTINCT FROM request_record.target_user_id_snapshot THEN
    RAISE EXCEPTION 'Account deletion requests require an independent reviewer';
  END IF;
  IF NOT public.can_review_account_deletion_request(request_record.id) THEN
    RAISE EXCEPTION 'A higher-scope administrator must review this request';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles profile
  WHERE profile.id = request_record.target_user_id_snapshot
  FOR UPDATE;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'The requested account no longer exists';
  END IF;

  canonical_district_id := target_profile.district_id;
  IF target_profile.school_id IS NOT NULL THEN
    SELECT COALESCE(target_profile.district_id, school.district_id)
    INTO canonical_district_id
    FROM public.schools school
    WHERE school.id = target_profile.school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The requested account school no longer exists';
    END IF;
  END IF;

  IF target_profile.role IS DISTINCT FROM request_record.requester_role
    OR (
      request_record.scope_type = 'school'
      AND (
        target_profile.school_id IS DISTINCT FROM request_record.school_id
        OR canonical_district_id IS DISTINCT FROM request_record.district_id
      )
    )
    OR (
      request_record.scope_type = 'district'
      AND (
        target_profile.school_id IS NOT NULL
        OR canonical_district_id IS DISTINCT FROM request_record.district_id
      )
    )
    OR (
      request_record.scope_type = 'platform'
      AND (
        target_profile.school_id IS NOT NULL
        OR canonical_district_id IS NOT NULL
      )
    )
  THEN
    RAISE EXCEPTION 'The account role or administrative scope changed after this request was submitted';
  END IF;

  IF requested_decision = 'approve'
    AND target_profile.role = 'super_admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles other_super
      WHERE other_super.role = 'super_admin'
        AND other_super.account_status = 'active'
        AND other_super.id <> target_profile.id
    )
  THEN
    RAISE EXCEPTION 'The last active platform administrator cannot be deleted';
  END IF;

  next_status := CASE
    WHEN requested_decision = 'approve' THEN 'approved'
    ELSE 'rejected'
  END;
  normalized_notes := NULLIF(
    LEFT(BTRIM(COALESCE(requested_notes, '')), 2000),
    ''
  );

  UPDATE public.account_deletion_requests request
  SET status = next_status,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      reviewer_notes = normalized_notes
  WHERE request.id = request_record.id;

  RETURN QUERY
  SELECT
    request_record.id,
    request_record.target_user_id_snapshot,
    next_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "deletion_requests_read"
  ON public.account_deletion_requests;
DROP POLICY IF EXISTS "deletion_requests_insert_own"
  ON public.account_deletion_requests;
DROP POLICY IF EXISTS "deletion_requests_admin_update"
  ON public.account_deletion_requests;

CREATE POLICY "deletion_requests_read"
  ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (
    target_user_id_snapshot = auth.uid()
    OR public.can_review_account_deletion_request(id)
  );

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.account_deletion_requests
  FROM authenticated;
GRANT SELECT
  ON TABLE public.account_deletion_requests
  TO authenticated;

-- All routes that can remove the final active platform administrator share
-- this lock. It closes the race where two concurrent changes each observe the
-- other administrator before both accounts are deactivated.
CREATE OR REPLACE FUNCTION public.protect_last_active_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin'
    AND OLD.account_status = 'active'
    AND (
      TG_OP = 'DELETE'
      OR (
        TG_OP = 'UPDATE'
        AND (
          NEW.role IS DISTINCT FROM 'super_admin'
          OR NEW.account_status IS DISTINCT FROM 'active'
        )
      )
    )
  THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('stormhub:elevated-account-deletion', 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles other_super
      WHERE other_super.role = 'super_admin'
        AND other_super.account_status = 'active'
        AND other_super.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'The last active platform administrator cannot be deleted or deactivated';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS profiles_00_protect_last_active_super_admin
  ON public.profiles;
CREATE TRIGGER profiles_00_protect_last_active_super_admin
  BEFORE UPDATE OF role, account_status OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_active_super_admin();

-- Keep the 2300 implementation private and wrap it with role-aware entry
-- points. The one-argument signature remains available for ordinary
-- student/teacher/admin deletion, so rolling application deploys keep working.
ALTER FUNCTION public.prepare_user_account_deletion(UUID)
  RENAME TO prepare_user_account_deletion_internal;

REVOKE ALL
  ON FUNCTION public.prepare_user_account_deletion_internal(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.prepare_user_account_deletion(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  target_role TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:elevated-account-deletion', 0)
  );

  SELECT profile.role
  INTO target_role
  FROM public.profiles profile
  WHERE profile.id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF target_role IN ('district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'An approved account deletion request is required for elevated administrators';
  END IF;

  RETURN public.prepare_user_account_deletion_internal(target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE FUNCTION public.prepare_user_account_deletion(
  target_user_id UUID,
  approved_request_id UUID
)
RETURNS UUID AS $$
DECLARE
  request_record public.account_deletion_requests%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
  canonical_district_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:elevated-account-deletion', 0)
  );

  SELECT *
  INTO request_record
  FROM public.account_deletion_requests request
  WHERE request.id = approved_request_id
  FOR UPDATE;

  IF request_record.id IS NULL
    OR request_record.status <> 'approved'
    OR request_record.target_user_id_snapshot IS DISTINCT FROM target_user_id
    OR request_record.reviewed_by IS NULL
    OR request_record.reviewed_by = target_user_id
  THEN
    RAISE EXCEPTION 'A matching independently approved account deletion request is required';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles profile
  WHERE profile.id = target_user_id
  FOR UPDATE;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF target_profile.role IS DISTINCT FROM request_record.requester_role THEN
    RAISE EXCEPTION 'The account role or administrative scope changed after this request was approved';
  END IF;

  canonical_district_id := target_profile.district_id;
  IF target_profile.school_id IS NOT NULL THEN
    SELECT COALESCE(target_profile.district_id, school.district_id)
    INTO canonical_district_id
    FROM public.schools school
    WHERE school.id = target_profile.school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The requested account school no longer exists';
    END IF;
  END IF;

  IF (
      request_record.scope_type = 'school'
      AND (
        target_profile.school_id IS DISTINCT FROM request_record.school_id
        OR canonical_district_id IS DISTINCT FROM request_record.district_id
      )
    )
    OR (
      request_record.scope_type = 'district'
      AND (
        target_profile.school_id IS NOT NULL
        OR canonical_district_id IS DISTINCT FROM request_record.district_id
      )
    )
    OR (
      request_record.scope_type = 'platform'
      AND (
        target_profile.school_id IS NOT NULL
        OR canonical_district_id IS NOT NULL
      )
    )
  THEN
    RAISE EXCEPTION 'The account role or administrative scope changed after this request was approved';
  END IF;

  IF target_profile.role = 'super_admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles other_super
      WHERE other_super.role = 'super_admin'
        AND other_super.account_status = 'active'
        AND other_super.id <> target_profile.id
    )
  THEN
    RAISE EXCEPTION 'The last active platform administrator cannot be deleted';
  END IF;

  RETURN public.prepare_user_account_deletion_internal(target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL
  ON FUNCTION public.prepare_user_account_deletion(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL
  ON FUNCTION public.prepare_user_account_deletion(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.prepare_user_account_deletion(UUID)
  TO service_role;
GRANT EXECUTE
  ON FUNCTION public.prepare_user_account_deletion(UUID, UUID)
  TO service_role;

REVOKE ALL
  ON FUNCTION public.submit_account_deletion_request(TEXT)
  FROM PUBLIC, anon;
REVOKE ALL
  ON FUNCTION public.can_review_account_deletion_request(UUID)
  FROM PUBLIC, anon;
REVOKE ALL
  ON FUNCTION public.review_account_deletion_request(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL
  ON FUNCTION public.protect_account_deletion_request_snapshot()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL
  ON FUNCTION public.protect_last_active_super_admin()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.submit_account_deletion_request(TEXT)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.can_review_account_deletion_request(UUID)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.review_account_deletion_request(UUID, TEXT, TEXT)
  TO authenticated;

COMMENT ON COLUMN public.account_deletion_requests.target_user_id_snapshot IS
  'Immutable target identity retained after the live profile reference is removed.';
COMMENT ON COLUMN public.account_deletion_requests.requester_role IS
  'Immutable role snapshot used to select the required independent reviewer.';
COMMENT ON COLUMN public.account_deletion_requests.scope_type IS
  'Immutable school, district, or platform scope derived when the request is submitted.';
COMMENT ON FUNCTION public.prepare_user_account_deletion(UUID, UUID) IS
  'Service-only preparation path for an independently approved elevated-account deletion; approved requests remain retryable after external failures.';

COMMIT;
