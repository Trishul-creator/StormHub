-- Durable, non-destructive school and district offboarding workflow.
--
-- This migration records a tenant's deletion/export instruction, separates the
-- requester from the reviewer, and preserves an append-only status history.
-- Final approval performs a reversible tenant/account deactivation. It never
-- physically purges tenant data.

BEGIN;

CREATE TABLE public.tenant_offboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('school', 'district')),
  -- Immutable audit identifiers intentionally have no tenant foreign keys.
  -- They must survive a later verified purge of the tenant rows.
  school_id UUID,
  district_id UUID NOT NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_reason TEXT NOT NULL CHECK (char_length(BTRIM(request_reason)) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (
      status IN (
        'requested',
        'under_review',
        'export_ready',
        'approved',
        'scheduled',
        'completed',
        'rejected',
        'cancelled'
      )
    ),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT CHECK (reviewer_notes IS NULL OR char_length(reviewer_notes) <= 2000),
  export_reference TEXT CHECK (export_reference IS NULL OR char_length(export_reference) <= 1000),
  export_prepared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  export_prepared_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  tenant_state_before JSONB,
  deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMPTZ,
  scheduled_purge_at TIMESTAMPTZ,
  completion_reference TEXT
    CHECK (completion_reference IS NULL OR char_length(completion_reference) <= 1000),
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  restored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'school' AND school_id IS NOT NULL)
    OR (scope_type = 'district' AND school_id IS NULL)
  ),
  CHECK (
    status NOT IN ('export_ready', 'approved', 'scheduled', 'completed')
    OR NULLIF(BTRIM(export_reference), '') IS NOT NULL
  ),
  CHECK (
    status NOT IN ('scheduled', 'completed')
    OR scheduled_purge_at IS NOT NULL
  ),
  CHECK (
    status <> 'completed'
    OR (
      completed_by IS NOT NULL
      AND completed_at IS NOT NULL
      AND NULLIF(BTRIM(completion_reference), '') IS NOT NULL
    )
  ),
  CHECK (
    status NOT IN ('approved', 'scheduled', 'completed')
    OR (
      tenant_state_before IS NOT NULL
      AND deactivated_by IS NOT NULL
      AND deactivated_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX tenant_offboarding_one_active_scope
  ON public.tenant_offboarding_requests (
    scope_type,
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::UUID),
    district_id
  )
  WHERE status IN ('requested', 'under_review', 'export_ready', 'approved', 'scheduled');

CREATE INDEX tenant_offboarding_scope_status
  ON public.tenant_offboarding_requests(district_id, school_id, status, requested_at DESC);

CREATE TABLE public.tenant_offboarding_profile_snapshots (
  request_id UUID NOT NULL
    REFERENCES public.tenant_offboarding_requests(id) ON DELETE RESTRICT,
  profile_id UUID NOT NULL,
  previous_account_status TEXT NOT NULL
    CHECK (previous_account_status IN ('active', 'suspended', 'deactivated')),
  previous_school_id UUID,
  previous_district_id UUID,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, profile_id)
);

CREATE INDEX tenant_offboarding_profile_snapshots_profile
  ON public.tenant_offboarding_profile_snapshots(profile_id, request_id);

CREATE TABLE public.tenant_offboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.tenant_offboarding_requests(id) ON DELETE RESTRICT,
  district_id UUID NOT NULL,
  school_id UUID,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'submitted',
        'status_changed',
        'tenant_deactivated',
        'tenant_restored'
      )
    ),
  from_status TEXT,
  to_status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tenant_offboarding_events_request_time
  ON public.tenant_offboarding_events(request_id, occurred_at);
CREATE INDEX tenant_offboarding_events_scope_time
  ON public.tenant_offboarding_events(district_id, school_id, occurred_at DESC);

ALTER TABLE public.tenant_offboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_offboarding_profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_offboarding_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.tenant_offboarding_requests,
  public.tenant_offboarding_profile_snapshots,
  public.tenant_offboarding_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.tenant_offboarding_requests,
  public.tenant_offboarding_profile_snapshots,
  public.tenant_offboarding_events
TO authenticated;
GRANT ALL ON TABLE
  public.tenant_offboarding_requests,
  public.tenant_offboarding_profile_snapshots,
  public.tenant_offboarding_events
TO service_role;

CREATE OR REPLACE FUNCTION public.can_read_tenant_offboarding(
  target_district_id UUID,
  target_school_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (
          actor.role = 'district_admin'
          AND actor.district_id = target_district_id
        )
        OR (
          actor.role = 'admin'
          AND target_school_id IS NOT NULL
          AND actor.school_id = target_school_id
        )
      )
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
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (
          target_scope_type = 'school'
          AND actor.role = 'district_admin'
          AND actor.district_id = target_district_id
        )
      )
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

CREATE OR REPLACE FUNCTION public.can_read_tenant_offboarding_request(
  target_request_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_offboarding_requests request
    WHERE request.id = target_request_id
      AND public.can_read_tenant_offboarding(request.district_id, request.school_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_read_tenant_offboarding_request(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_tenant_offboarding_request(UUID)
  TO authenticated, service_role;

CREATE POLICY tenant_offboarding_requests_scoped_read
  ON public.tenant_offboarding_requests
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_offboarding(district_id, school_id));

CREATE POLICY tenant_offboarding_profile_snapshots_scoped_read
  ON public.tenant_offboarding_profile_snapshots
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_offboarding_request(request_id));

CREATE POLICY tenant_offboarding_events_scoped_read
  ON public.tenant_offboarding_events
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_offboarding(district_id, school_id));

CREATE OR REPLACE FUNCTION public.log_tenant_offboarding_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tenant_offboarding_events (
      request_id,
      district_id,
      school_id,
      actor_user_id,
      event_type,
      from_status,
      to_status
    ) VALUES (
      NEW.id,
      NEW.district_id,
      NEW.school_id,
      auth.uid(),
      'submitted',
      NULL,
      NEW.status
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.tenant_offboarding_events (
      request_id,
      district_id,
      school_id,
      actor_user_id,
      event_type,
      from_status,
      to_status
    ) VALUES (
      NEW.id,
      NEW.district_id,
      NEW.school_id,
      auth.uid(),
      'status_changed',
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.log_tenant_offboarding_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tenant_offboarding_event_log
  AFTER INSERT OR UPDATE OF status ON public.tenant_offboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_tenant_offboarding_event();

CREATE OR REPLACE FUNCTION public.submit_tenant_offboarding_request(
  requested_scope_type TEXT,
  requested_scope_id UUID,
  requested_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  resolved_school_id UUID;
  resolved_district_id UUID;
  created_id UUID;
BEGIN
  SELECT * INTO actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND account_status = 'active';

  IF actor.id IS NULL OR actor.role NOT IN ('admin', 'district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Active administrator access required';
  END IF;
  IF requested_scope_type NOT IN ('school', 'district') THEN
    RAISE EXCEPTION 'Choose a school or district scope';
  END IF;
  IF char_length(BTRIM(COALESCE(requested_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Provide an offboarding reason between 10 and 2,000 characters';
  END IF;

  IF requested_scope_type = 'school' THEN
    SELECT school.id, school.district_id
    INTO resolved_school_id, resolved_district_id
    FROM public.schools school
    WHERE school.id = requested_scope_id;

    IF resolved_school_id IS NULL OR resolved_district_id IS NULL THEN
      RAISE EXCEPTION 'The selected school must belong to a district';
    END IF;
    IF actor.role = 'admin' AND actor.school_id IS DISTINCT FROM resolved_school_id THEN
      RAISE EXCEPTION 'School administrators can only request offboarding for their own school';
    END IF;
    IF actor.role = 'district_admin'
      AND actor.district_id IS DISTINCT FROM resolved_district_id
    THEN
      RAISE EXCEPTION 'District administrators can only request offboarding inside their district';
    END IF;
  ELSE
    SELECT district.id
    INTO resolved_district_id
    FROM public.districts district
    WHERE district.id = requested_scope_id;

    IF resolved_district_id IS NULL THEN
      RAISE EXCEPTION 'District not found';
    END IF;
    IF actor.role = 'admin' THEN
      RAISE EXCEPTION 'Only district or platform administrators can request district offboarding';
    END IF;
    IF actor.role = 'district_admin'
      AND actor.district_id IS DISTINCT FROM resolved_district_id
    THEN
      RAISE EXCEPTION 'District administrators can only request offboarding for their own district';
    END IF;
  END IF;

  -- School and district workflows in the same tenant tree must serialize.
  -- Otherwise a later cancellation could restore a child underneath an
  -- intentionally inactive district (or restore users across nested scopes).
  PERFORM pg_advisory_xact_lock(hashtextextended(resolved_district_id::TEXT, 0));

  IF requested_scope_type = 'school'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_offboarding_requests request
      WHERE request.scope_type = 'district'
        AND request.district_id = resolved_district_id
        AND request.status IN (
          'requested', 'under_review', 'export_ready', 'approved', 'scheduled'
        )
    )
  THEN
    RAISE EXCEPTION 'An active district offboarding request already covers this school';
  END IF;
  IF requested_scope_type = 'district'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_offboarding_requests request
      WHERE request.scope_type = 'school'
        AND request.district_id = resolved_district_id
        AND request.status IN (
          'requested', 'under_review', 'export_ready', 'approved', 'scheduled'
        )
    )
  THEN
    RAISE EXCEPTION 'Resolve active school offboarding requests before requesting district offboarding';
  END IF;

  INSERT INTO public.tenant_offboarding_requests (
    scope_type,
    school_id,
    district_id,
    requested_by,
    request_reason
  ) VALUES (
    requested_scope_type,
    resolved_school_id,
    resolved_district_id,
    actor.id,
    BTRIM(requested_reason)
  )
  RETURNING id INTO created_id;

  RETURN created_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'An active offboarding request already exists for this tenant';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_tenant_offboarding_request(
  target_request_id UUID,
  next_status TEXT,
  requested_reviewer_notes TEXT DEFAULT NULL,
  requested_export_reference TEXT DEFAULT NULL,
  requested_scheduled_purge_at TIMESTAMPTZ DEFAULT NULL,
  requested_completion_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  request public.tenant_offboarding_requests%ROWTYPE;
  tenant_snapshot JSONB;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(requested_reviewer_notes, '')), '');
  normalized_export_reference TEXT :=
    NULLIF(BTRIM(COALESCE(requested_export_reference, '')), '');
  normalized_completion_reference TEXT :=
    NULLIF(BTRIM(COALESCE(requested_completion_reference, '')), '');
BEGIN
  SELECT * INTO actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND account_status = 'active';
  SELECT * INTO request
  FROM public.tenant_offboarding_requests
  WHERE id = target_request_id
  FOR UPDATE;

  IF request.id IS NULL THEN
    RAISE EXCEPTION 'Offboarding request not found';
  END IF;
  IF actor.id IS NULL
    OR NOT public.can_review_tenant_offboarding(request.scope_type, request.district_id)
  THEN
    RAISE EXCEPTION 'A higher-scope administrator must review this request';
  END IF;
  IF request.requested_by = actor.id THEN
    RAISE EXCEPTION 'The requester cannot review their own offboarding request';
  END IF;
  IF next_status NOT IN (
    'under_review', 'export_ready', 'approved', 'scheduled', 'completed', 'rejected'
  ) THEN
    RAISE EXCEPTION 'Invalid offboarding status';
  END IF;
  IF char_length(COALESCE(normalized_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Reviewer notes must be 2,000 characters or fewer';
  END IF;

  IF NOT (
    (request.status = 'requested' AND next_status IN ('under_review', 'rejected'))
    OR (request.status = 'under_review' AND next_status IN ('export_ready', 'rejected'))
    OR (request.status = 'export_ready' AND next_status IN ('approved', 'rejected'))
    OR (request.status = 'approved' AND next_status = 'scheduled')
    OR (request.status = 'scheduled' AND next_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Invalid offboarding status transition from % to %',
      request.status,
      next_status;
  END IF;

  IF actor.role <> 'super_admin'
    AND (
      request.scope_type <> 'school'
      OR actor.role <> 'district_admin'
      OR actor.district_id IS DISTINCT FROM request.district_id
      OR next_status NOT IN ('under_review', 'export_ready', 'rejected')
    )
  THEN
    RAISE EXCEPTION 'Only a platform administrator can approve or schedule tenant deletion';
  END IF;

  IF next_status = 'rejected' AND char_length(COALESCE(normalized_notes, '')) < 10 THEN
    RAISE EXCEPTION 'Explain the rejection in at least 10 characters';
  END IF;
  IF next_status IN ('export_ready', 'approved', 'scheduled', 'completed')
    AND COALESCE(normalized_export_reference, request.export_reference) IS NULL
  THEN
    RAISE EXCEPTION 'Record the protected export or preservation reference first';
  END IF;
  IF next_status = 'scheduled'
    AND (
      requested_scheduled_purge_at IS NULL
      OR requested_scheduled_purge_at <= NOW()
    )
  THEN
    RAISE EXCEPTION 'Choose a future deletion window';
  END IF;
  IF next_status = 'completed'
    AND (
      request.scheduled_purge_at IS NULL
      OR request.scheduled_purge_at > NOW()
    )
  THEN
    RAISE EXCEPTION 'The scheduled deletion window has not been reached';
  END IF;
  IF next_status = 'completed'
    AND char_length(COALESCE(normalized_completion_reference, '')) < 5
  THEN
    RAISE EXCEPTION 'Record the deletion evidence reference before completion';
  END IF;

  IF next_status = 'approved' THEN
    INSERT INTO public.tenant_offboarding_profile_snapshots (
      request_id,
      profile_id,
      previous_account_status,
      previous_school_id,
      previous_district_id
    )
    SELECT
      request.id,
      profile.id,
      COALESCE(profile.account_status, 'active'),
      profile.school_id,
      profile.district_id
    FROM public.profiles profile
    WHERE (
      request.scope_type = 'school'
      AND profile.school_id = request.school_id
    )
    OR (
      request.scope_type = 'district'
      AND profile.district_id = request.district_id
    )
    ON CONFLICT (request_id, profile_id) DO NOTHING;

    UPDATE public.profiles profile
    SET account_status = 'deactivated',
        updated_at = NOW()
    WHERE (
      request.scope_type = 'school'
      AND profile.school_id = request.school_id
    )
    OR (
      request.scope_type = 'district'
      AND profile.district_id = request.district_id
    );

    IF request.scope_type = 'school' THEN
      SELECT jsonb_build_object(
        'scope_type', 'school',
        'school_id', school.id,
        'is_active', school.is_active,
        'is_public', school.is_public
      )
      INTO tenant_snapshot
      FROM public.schools school
      WHERE school.id = request.school_id
      FOR UPDATE;

      IF tenant_snapshot IS NULL THEN
        RAISE EXCEPTION 'School not found';
      END IF;

      UPDATE public.schools
      SET is_active = FALSE,
          is_public = FALSE,
          updated_at = NOW()
      WHERE id = request.school_id;
    ELSE
      SELECT jsonb_build_object(
        'scope_type', 'district',
        'district_id', district.id,
        'is_active', district.is_active,
        'schools', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', school.id,
                'is_active', school.is_active,
                'is_public', school.is_public
              )
              ORDER BY school.id
            )
            FROM public.schools school
            WHERE school.district_id = district.id
          ),
          '[]'::JSONB
        )
      )
      INTO tenant_snapshot
      FROM public.districts district
      WHERE district.id = request.district_id
      FOR UPDATE;

      IF tenant_snapshot IS NULL THEN
        RAISE EXCEPTION 'District not found';
      END IF;

      UPDATE public.districts
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = request.district_id;

      UPDATE public.schools
      SET is_active = FALSE,
          is_public = FALSE,
          updated_at = NOW()
      WHERE district_id = request.district_id;
    END IF;

    INSERT INTO public.tenant_offboarding_events (
      request_id,
      district_id,
      school_id,
      actor_user_id,
      event_type,
      from_status,
      to_status
    ) VALUES (
      request.id,
      request.district_id,
      request.school_id,
      actor.id,
      'tenant_deactivated',
      request.status,
      next_status
    );
  END IF;

  UPDATE public.tenant_offboarding_requests
  SET
    status = next_status,
    acknowledged_by = CASE
      WHEN next_status = 'under_review' THEN actor.id
      ELSE acknowledged_by
    END,
    acknowledged_at = CASE
      WHEN next_status = 'under_review' THEN NOW()
      ELSE acknowledged_at
    END,
    reviewed_by = actor.id,
    reviewed_at = NOW(),
    reviewer_notes = COALESCE(normalized_notes, reviewer_notes),
    export_reference = COALESCE(normalized_export_reference, export_reference),
    export_prepared_by = CASE
      WHEN next_status = 'export_ready' THEN actor.id
      ELSE export_prepared_by
    END,
    export_prepared_at = CASE
      WHEN next_status = 'export_ready' THEN NOW()
      ELSE export_prepared_at
    END,
    approved_by = CASE
      WHEN next_status = 'approved' THEN actor.id
      ELSE approved_by
    END,
    approved_at = CASE
      WHEN next_status = 'approved' THEN NOW()
      ELSE approved_at
    END,
    tenant_state_before = CASE
      WHEN next_status = 'approved' THEN tenant_snapshot
      ELSE tenant_state_before
    END,
    deactivated_by = CASE
      WHEN next_status = 'approved' THEN actor.id
      ELSE deactivated_by
    END,
    deactivated_at = CASE
      WHEN next_status = 'approved' THEN NOW()
      ELSE deactivated_at
    END,
    scheduled_purge_at = CASE
      WHEN next_status = 'scheduled' THEN requested_scheduled_purge_at
      ELSE scheduled_purge_at
    END,
    completion_reference = CASE
      WHEN next_status = 'completed' THEN normalized_completion_reference
      ELSE completion_reference
    END,
    completed_by = CASE
      WHEN next_status = 'completed' THEN actor.id
      ELSE completed_by
    END,
    completed_at = CASE
      WHEN next_status = 'completed' THEN NOW()
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE id = request.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_tenant_offboarding_request(
  target_request_id UUID,
  cancellation_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  request public.tenant_offboarding_requests%ROWTYPE;
  normalized_reason TEXT := NULLIF(BTRIM(COALESCE(cancellation_reason, '')), '');
  restored_school RECORD;
BEGIN
  SELECT * INTO actor
  FROM public.profiles
  WHERE id = auth.uid()
    AND account_status = 'active';
  SELECT * INTO request
  FROM public.tenant_offboarding_requests
  WHERE id = target_request_id
  FOR UPDATE;

  IF request.id IS NULL THEN
    RAISE EXCEPTION 'Offboarding request not found';
  END IF;
  IF actor.id IS NULL OR actor.role NOT IN ('admin', 'district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Active administrator access required';
  END IF;
  IF request.status IN ('approved', 'scheduled')
    AND actor.role <> 'super_admin'
  THEN
    RAISE EXCEPTION 'Only a platform administrator can restore an approved tenant';
  END IF;
  IF request.status IN ('requested', 'under_review', 'export_ready')
    AND actor.role <> 'super_admin'
    AND (
      request.requested_by IS DISTINCT FROM actor.id
      OR (
        actor.role = 'admin'
        AND (
          request.scope_type <> 'school'
          OR actor.school_id IS DISTINCT FROM request.school_id
        )
      )
      OR (
        actor.role = 'district_admin'
        AND actor.district_id IS DISTINCT FROM request.district_id
      )
    )
  THEN
    RAISE EXCEPTION 'Only the requester or a platform administrator can cancel this request';
  END IF;
  IF request.status NOT IN ('requested', 'under_review', 'export_ready', 'approved', 'scheduled') THEN
    RAISE EXCEPTION 'This offboarding request can no longer be cancelled';
  END IF;
  IF char_length(COALESCE(normalized_reason, '')) < 10 THEN
    RAISE EXCEPTION 'Explain the cancellation in at least 10 characters';
  END IF;

  IF request.status IN ('approved', 'scheduled') THEN
    IF request.tenant_state_before IS NULL THEN
      RAISE EXCEPTION 'The recorded tenant state is unavailable; restore must be reviewed manually';
    END IF;

    IF request.scope_type = 'school' THEN
      UPDATE public.schools
      SET
        is_active = COALESCE((request.tenant_state_before->>'is_active')::BOOLEAN, TRUE),
        is_public = COALESCE((request.tenant_state_before->>'is_public')::BOOLEAN, TRUE),
        updated_at = NOW()
      WHERE id = request.school_id;
    ELSE
      UPDATE public.districts
      SET
        is_active = COALESCE((request.tenant_state_before->>'is_active')::BOOLEAN, TRUE),
        updated_at = NOW()
      WHERE id = request.district_id;

      FOR restored_school IN
        SELECT *
        FROM jsonb_to_recordset(
          COALESCE(request.tenant_state_before->'schools', '[]'::JSONB)
        ) AS restored(id UUID, is_active BOOLEAN, is_public BOOLEAN)
      LOOP
        UPDATE public.schools
        SET
          is_active = restored_school.is_active,
          is_public = restored_school.is_public,
          updated_at = NOW()
        WHERE id = restored_school.id
          AND district_id = request.district_id;
      END LOOP;
    END IF;

    UPDATE public.profiles profile
    SET
      account_status = snapshot.previous_account_status,
      updated_at = NOW()
    FROM public.tenant_offboarding_profile_snapshots snapshot
    WHERE snapshot.request_id = request.id
      AND profile.id = snapshot.profile_id;

    INSERT INTO public.tenant_offboarding_events (
      request_id,
      district_id,
      school_id,
      actor_user_id,
      event_type,
      from_status,
      to_status
    ) VALUES (
      request.id,
      request.district_id,
      request.school_id,
      actor.id,
      'tenant_restored',
      request.status,
      'cancelled'
    );
  END IF;

  UPDATE public.tenant_offboarding_requests
  SET
    status = 'cancelled',
    reviewer_notes = normalized_reason,
    cancelled_by = actor.id,
    cancelled_at = NOW(),
    restored_by = CASE
      WHEN request.status IN ('approved', 'scheduled') THEN actor.id
      ELSE restored_by
    END,
    restored_at = CASE
      WHEN request.status IN ('approved', 'scheduled') THEN NOW()
      ELSE restored_at
    END,
    updated_at = NOW()
  WHERE id = request.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON TABLE public.tenant_offboarding_requests IS
  'Tracks export/deletion instructions using immutable scope UUIDs that outlive a later tenant purge.';
COMMENT ON TABLE public.tenant_offboarding_events IS
  'Append-only status history with immutable scope UUIDs, without request reasons or exported data.';
COMMENT ON TABLE public.tenant_offboarding_profile_snapshots IS
  'Per-request account-status snapshot used only to restore an approved tenant before physical purge.';
COMMENT ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT) IS
  'Creates one active, scope-checked school or district offboarding request.';
COMMENT ON FUNCTION public.review_tenant_offboarding_request(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) IS
  'Advances a request; platform approval transactionally deactivates the tenant, while physical deletion remains separate and evidence-gated.';
COMMENT ON FUNCTION public.cancel_tenant_offboarding_request(UUID, TEXT) IS
  'Cancels an early-stage request or lets a platform administrator restore an approved tenant before purge.';

COMMIT;
