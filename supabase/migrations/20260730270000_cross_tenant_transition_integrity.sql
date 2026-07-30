-- Close cross-tenant transition races discovered during the final adversarial
-- review. Elevated role assignment now uses one database transaction, and
-- offboarding review/restoration owns both the legal-hold gate and tenant-tree
-- lock before it reads or mutates tenant state.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_district_administrator(
  target_user_id UUID,
  target_district_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:elevated-role-assignment', 0)
  );

  SELECT *
  INTO actor
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  SELECT *
  INTO target
  FROM public.profiles
  WHERE id = target_user_id
  FOR UPDATE;

  IF actor.id IS NULL
    OR actor.role <> 'super_admin'
    OR actor.account_status <> 'active'
    OR NOT public.has_admin_mfa()
  THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  IF target.id = actor.id OR target.role = 'super_admin' THEN
    RAISE EXCEPTION 'Platform administrator assignments are protected';
  END IF;
  IF target.account_status <> 'active' THEN
    RAISE EXCEPTION 'Only an active account can manage a district';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.districts district
    WHERE district.id = target_district_id
      AND district.is_active = TRUE
      AND district.access_disabled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Choose an active district';
  END IF;

  -- Terminalize both active and pending membership paths before clearing
  -- school scope, so no old-tenant roster/coursework access can survive and no
  -- previously pending join can be approved after the promotion.
  UPDATE public.club_memberships
  SET status = 'left',
      role = 'member'
  WHERE user_id = target.id
    AND status IN ('active', 'pending');

  UPDATE public.profiles
  SET role = 'district_admin',
      school_id = NULL,
      district_id = target_district_id,
      updated_at = NOW()
  WHERE id = target.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.assign_district_administrator(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_district_administrator(UUID, UUID)
  TO authenticated;

-- Wrap the existing reviewed workflow without duplicating its state machine.
-- Both wrappers acquire the global legal-hold gate first and the immutable
-- request scope second, before the internal function snapshots/deactivates or
-- restores any record.
ALTER FUNCTION public.review_tenant_offboarding_request(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) RENAME TO review_tenant_offboarding_request_internal;

REVOKE ALL ON FUNCTION public.review_tenant_offboarding_request_internal(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
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
DECLARE
  target_district_id UUID;
  target_school_id UUID;
  scope_lock_key BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  SELECT request.district_id, request.school_id
  INTO target_district_id, target_school_id
  FROM public.tenant_offboarding_requests request
  WHERE request.id = target_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offboarding request not found';
  END IF;

  scope_lock_key := public.tenant_offboarding_scope_lock_key(
    target_district_id,
    target_school_id
  );
  IF scope_lock_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(scope_lock_key);
  END IF;

  RETURN public.review_tenant_offboarding_request_internal(
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
  RENAME TO cancel_tenant_offboarding_request_internal;

REVOKE ALL ON FUNCTION public.cancel_tenant_offboarding_request_internal(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.cancel_tenant_offboarding_request(
  target_request_id UUID,
  cancellation_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  target_district_id UUID;
  target_school_id UUID;
  scope_lock_key BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  SELECT request.district_id, request.school_id
  INTO target_district_id, target_school_id
  FROM public.tenant_offboarding_requests request
  WHERE request.id = target_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offboarding request not found';
  END IF;

  scope_lock_key := public.tenant_offboarding_scope_lock_key(
    target_district_id,
    target_school_id
  );
  IF scope_lock_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(scope_lock_key);
  END IF;

  RETURN public.cancel_tenant_offboarding_request_internal(
    target_request_id,
    cancellation_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.review_tenant_offboarding_request(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_tenant_offboarding_request(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_district_administrator(UUID, UUID) IS
  'Atomically promotes one active non-platform account, clears all active club access, and assigns exact district scope.';
COMMENT ON FUNCTION public.review_tenant_offboarding_request(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) IS
  'Advances an offboarding request while holding the legal-hold and tenant-tree transition barriers.';
COMMENT ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT) IS
  'Cancels or restores an offboarding request while holding the legal-hold and tenant-tree transition barriers.';

COMMIT;
