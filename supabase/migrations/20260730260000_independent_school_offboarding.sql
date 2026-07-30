-- Extend the audited tenant-offboarding workflow to independent schools.
-- Independent school requests retain a NULL district UUID and serialize on the
-- school UUID; district-backed schools continue to serialize on their district.

BEGIN;

ALTER TABLE public.tenant_offboarding_requests
  ALTER COLUMN district_id DROP NOT NULL;
ALTER TABLE public.tenant_offboarding_events
  ALTER COLUMN district_id DROP NOT NULL;

ALTER TABLE public.tenant_offboarding_requests
  DROP CONSTRAINT IF EXISTS tenant_offboarding_scope_identity_check;
ALTER TABLE public.tenant_offboarding_requests
  ADD CONSTRAINT tenant_offboarding_scope_identity_check
  CHECK (
    (
      scope_type = 'school'
      AND school_id IS NOT NULL
    )
    OR (
      scope_type = 'district'
      AND school_id IS NULL
      AND district_id IS NOT NULL
    )
  );

DROP INDEX IF EXISTS public.tenant_offboarding_one_active_scope;
CREATE UNIQUE INDEX tenant_offboarding_one_active_scope
  ON public.tenant_offboarding_requests (
    scope_type,
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(district_id, '00000000-0000-0000-0000-000000000000'::UUID)
  )
  WHERE status IN ('requested', 'under_review', 'export_ready', 'approved', 'scheduled');

CREATE OR REPLACE FUNCTION public.tenant_offboarding_scope_lock_key(
  target_district_id UUID,
  target_school_id UUID
)
RETURNS BIGINT AS $$
  SELECT CASE
    WHEN target_district_id IS NOT NULL
      THEN hashtextextended(target_district_id::TEXT, 0)
    WHEN target_school_id IS NOT NULL
      THEN hashtextextended('independent-school:' || target_school_id::TEXT, 0)
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.lock_tenant_offboarding_district_transition()
RETURNS TRIGGER AS $$
DECLARE
  scope_lock_key BIGINT;
BEGIN
  scope_lock_key := public.tenant_offboarding_scope_lock_key(
    NEW.district_id,
    NEW.school_id
  );
  IF scope_lock_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(scope_lock_key);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- A school cannot move into or out of a district after an export snapshot has
-- become authoritative. Lock the school plus both district sides so concurrent
-- moves and offboarding status transitions make the same atomic decision.
CREATE OR REPLACE FUNCTION public.enforce_offboarding_district_tree_freeze()
RETURNS TRIGGER AS $$
DECLARE
  source_district_id UUID;
  scope_lock_key BIGINT;
BEGIN
  source_district_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.district_id ELSE NULL END;

  IF TG_OP = 'UPDATE'
    AND NEW.district_id IS NOT DISTINCT FROM source_district_id
  THEN
    RETURN NEW;
  END IF;

  FOR scope_lock_key IN
    SELECT DISTINCT candidate
    FROM unnest(
      ARRAY[
        public.tenant_offboarding_scope_lock_key(NULL, NEW.id),
        public.tenant_offboarding_scope_lock_key(source_district_id, NULL),
        public.tenant_offboarding_scope_lock_key(NEW.district_id, NULL)
      ]::BIGINT[]
    ) AS candidate
    WHERE candidate IS NOT NULL
    ORDER BY candidate
  LOOP
    PERFORM pg_advisory_xact_lock(scope_lock_key);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_offboarding_requests request
    WHERE request.status IN ('export_ready', 'approved', 'scheduled')
      AND (
        (
          request.scope_type = 'school'
          AND request.school_id = NEW.id
        )
        OR (
          request.scope_type = 'district'
          AND request.district_id IN (source_district_id, NEW.district_id)
        )
      )
  ) THEN
    RAISE EXCEPTION
      'School district membership is frozen by an active offboarding export or purge';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

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
  scope_lock_key BIGINT;
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

    IF resolved_school_id IS NULL THEN
      RAISE EXCEPTION 'School not found';
    END IF;
    IF actor.role = 'admin' AND actor.school_id IS DISTINCT FROM resolved_school_id THEN
      RAISE EXCEPTION 'School administrators can only request offboarding for their own school';
    END IF;
    IF actor.role = 'district_admin'
      AND (
        resolved_district_id IS NULL
        OR actor.district_id IS DISTINCT FROM resolved_district_id
      )
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

  scope_lock_key := public.tenant_offboarding_scope_lock_key(
    resolved_district_id,
    resolved_school_id
  );
  IF scope_lock_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(scope_lock_key);
  END IF;

  IF requested_scope_type = 'school'
    AND resolved_district_id IS NOT NULL
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.tenant_offboarding_scope_lock_key(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_tenant_offboarding_district_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_offboarding_district_tree_freeze()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_offboarding_scope_lock_key(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_tenant_offboarding_request(TEXT, UUID, TEXT) IS
  'Creates one active, scope-checked offboarding request for a district-backed or independent school tenant.';

COMMIT;
