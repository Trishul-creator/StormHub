-- Make tenant removal available only through the audited offboarding workflow,
-- while preserving legal-hold and support-audit evidence after a later,
-- separately verified physical purge.

BEGIN;

-- Existing FOR ALL policies are also eligible for DELETE. Removing the table
-- privilege makes those policies irrelevant for direct tenant deletion; only
-- service-role/operator tooling can perform the final purge after the
-- offboarding workflow has completed.
REVOKE DELETE ON TABLE public.schools, public.districts FROM authenticated;

-- A legal hold is evidence and must outlive the tenant row it protected. The
-- placement RPC validates these immutable scope UUIDs before insertion, so a
-- foreign key would add no safety while permanently blocking an authorized
-- later purge.
ALTER TABLE public.legal_holds
  DROP CONSTRAINT IF EXISTS legal_holds_school_id_fkey,
  DROP CONSTRAINT IF EXISTS legal_holds_district_id_fkey;

-- Support access history also survives account, session, and tenant cleanup.
ALTER TABLE public.platform_support_sessions
  DROP CONSTRAINT IF EXISTS platform_support_sessions_school_id_fkey,
  ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.platform_support_sessions
  ADD CONSTRAINT platform_support_sessions_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;

ALTER TABLE public.platform_support_access_log
  DROP CONSTRAINT IF EXISTS platform_support_access_log_session_id_fkey,
  DROP CONSTRAINT IF EXISTS platform_support_access_log_school_id_fkey,
  ALTER COLUMN session_id DROP NOT NULL,
  ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.platform_support_access_log
  ADD CONSTRAINT platform_support_access_log_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.platform_support_sessions(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT platform_support_access_log_school_id_fkey
    FOREIGN KEY (school_id)
    REFERENCES public.schools(id)
    ON DELETE SET NULL;

-- Backfill explicit access markers for requests approved before marker support
-- was deployed. A school-specific request wins over a district request.
WITH latest_district_request AS (
  SELECT DISTINCT ON (request.district_id)
    request.id,
    request.district_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'district'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.district_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) DESC,
    request.id DESC
)
UPDATE public.districts district
SET access_disabled_at = request.disabled_at,
    access_disabled_by_offboarding_request = request.id
FROM latest_district_request request
WHERE district.id = request.district_id
  AND district.access_disabled_by_offboarding_request IS NULL;

WITH latest_school_request AS (
  SELECT DISTINCT ON (request.school_id)
    request.id,
    request.school_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'school'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.school_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) DESC,
    request.id DESC
)
UPDATE public.schools school
SET access_disabled_at = request.disabled_at,
    access_disabled_by_offboarding_request = request.id
FROM latest_school_request request
WHERE school.id = request.school_id
  AND school.access_disabled_by_offboarding_request IS NULL;

WITH latest_district_request AS (
  SELECT DISTINCT ON (request.district_id)
    request.id,
    request.district_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'district'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.district_id,
    COALESCE(
      request.deactivated_at,
      request.approved_at,
      request.updated_at,
      request.requested_at
    ) DESC,
    request.id DESC
)
UPDATE public.schools school
SET access_disabled_at = request.disabled_at,
    access_disabled_by_offboarding_request = request.id
FROM latest_district_request request
WHERE school.district_id = request.district_id
  AND school.access_disabled_by_offboarding_request IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_tenant_access_marker_integrity()
RETURNS TRIGGER AS $$
DECLARE
  marker_request public.tenant_offboarding_requests%ROWTYPE;
  previous_request_status TEXT;
  marker_matches_scope BOOLEAN := FALSE;
BEGIN
  IF (NEW.access_disabled_at IS NULL)
    <> (NEW.access_disabled_by_offboarding_request IS NULL)
  THEN
    RAISE EXCEPTION
      'Tenant access marker timestamp and request ID must be changed together';
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.access_disabled_by_offboarding_request
      IS NOT DISTINCT FROM OLD.access_disabled_by_offboarding_request
    AND NEW.access_disabled_at IS DISTINCT FROM OLD.access_disabled_at
  THEN
    RAISE EXCEPTION 'Tenant access marker timestamps are immutable';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.access_disabled_by_offboarding_request IS NOT NULL
    AND NEW.access_disabled_by_offboarding_request
      IS DISTINCT FROM OLD.access_disabled_by_offboarding_request
  THEN
    SELECT request.status
    INTO previous_request_status
    FROM public.tenant_offboarding_requests request
    WHERE request.id = OLD.access_disabled_by_offboarding_request;

    IF previous_request_status IS DISTINCT FROM 'cancelled' THEN
      RAISE EXCEPTION 'Tenant access markers are controlled by the offboarding workflow';
    END IF;
  END IF;

  IF NEW.access_disabled_by_offboarding_request IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO marker_request
  FROM public.tenant_offboarding_requests request
  WHERE request.id = NEW.access_disabled_by_offboarding_request;

  IF marker_request.id IS NULL
    OR marker_request.status NOT IN ('approved', 'scheduled', 'completed')
  THEN
    RAISE EXCEPTION
      'Tenant access markers require an approved offboarding request';
  END IF;

  IF TG_TABLE_NAME = 'districts' THEN
    marker_matches_scope :=
      marker_request.scope_type = 'district'
      AND marker_request.district_id = NEW.id;
  ELSE
    marker_matches_scope :=
      (
        marker_request.scope_type = 'school'
        AND marker_request.school_id = NEW.id
      )
      OR (
        marker_request.scope_type = 'district'
        AND marker_request.district_id = NEW.district_id
      );
  END IF;

  IF NOT marker_matches_scope THEN
    RAISE EXCEPTION
      'The offboarding request does not match this tenant access marker';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS districts_tenant_access_marker_integrity
  ON public.districts;
CREATE TRIGGER districts_tenant_access_marker_integrity
  BEFORE INSERT OR UPDATE OF
    access_disabled_at,
    access_disabled_by_offboarding_request
  ON public.districts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_access_marker_integrity();

DROP TRIGGER IF EXISTS schools_tenant_access_marker_integrity
  ON public.schools;
CREATE TRIGGER schools_tenant_access_marker_integrity
  BEFORE INSERT OR UPDATE OF
    access_disabled_at,
    access_disabled_by_offboarding_request
  ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_access_marker_integrity();

-- These checks are deferred so cancellation can restore the saved tenant and
-- then clear its marker in one transaction. The functions read the final row
-- state rather than a transition snapshot, preventing an earlier statement in
-- that transaction from producing a false failure.
CREATE OR REPLACE FUNCTION public.enforce_disabled_tenant_final_state()
RETURNS TRIGGER AS $$
DECLARE
  tenant_is_active BOOLEAN;
  tenant_is_public BOOLEAN;
  disabled_request_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'districts' THEN
    SELECT district.is_active, district.access_disabled_by_offboarding_request
    INTO tenant_is_active, disabled_request_id
    FROM public.districts district
    WHERE district.id = NEW.id;

    IF disabled_request_id IS NOT NULL AND tenant_is_active THEN
      RAISE EXCEPTION 'An offboarded district cannot be reactivated';
    END IF;
  ELSE
    SELECT
      school.is_active,
      school.is_public,
      school.access_disabled_by_offboarding_request
    INTO tenant_is_active, tenant_is_public, disabled_request_id
    FROM public.schools school
    WHERE school.id = NEW.id;

    IF disabled_request_id IS NOT NULL
      AND (tenant_is_active OR tenant_is_public)
    THEN
      RAISE EXCEPTION 'An offboarded school cannot be reactivated';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.enforce_disabled_profile_final_state()
RETURNS TRIGGER AS $$
DECLARE
  profile_is_active BOOLEAN;
  tenant_is_disabled BOOLEAN;
BEGIN
  SELECT
    profile.account_status = 'active',
    (
      school.access_disabled_at IS NOT NULL
      OR district.access_disabled_at IS NOT NULL
    )
  INTO profile_is_active, tenant_is_disabled
  FROM public.profiles profile
  LEFT JOIN public.schools school ON school.id = profile.school_id
  LEFT JOIN public.districts district
    ON district.id = COALESCE(profile.district_id, school.district_id)
  WHERE profile.id = NEW.id
    AND profile.role <> 'super_admin';

  IF profile_is_active AND tenant_is_disabled THEN
    RAISE EXCEPTION 'Accounts in an offboarded tenant cannot be reactivated';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS districts_disabled_tenant_final_state
  ON public.districts;
CREATE CONSTRAINT TRIGGER districts_disabled_tenant_final_state
  AFTER INSERT OR UPDATE ON public.districts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disabled_tenant_final_state();

DROP TRIGGER IF EXISTS schools_disabled_tenant_final_state
  ON public.schools;
CREATE CONSTRAINT TRIGGER schools_disabled_tenant_final_state
  AFTER INSERT OR UPDATE ON public.schools
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disabled_tenant_final_state();

DROP TRIGGER IF EXISTS profiles_disabled_tenant_final_state
  ON public.profiles;
CREATE CONSTRAINT TRIGGER profiles_disabled_tenant_final_state
  AFTER INSERT OR UPDATE OF account_status, school_id, district_id, role
  ON public.profiles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disabled_profile_final_state();

-- A district approval must not overwrite a pre-existing school-specific
-- suspension. Its later cancellation clears only markers written by that
-- district request.
CREATE OR REPLACE FUNCTION public.sync_offboarding_access_marker()
RETURNS TRIGGER AS $$
DECLARE
  disabled_at TIMESTAMPTZ :=
    COALESCE(NEW.deactivated_at, NEW.approved_at, NEW.updated_at, NOW());
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.scope_type = 'school' THEN
      UPDATE public.schools
      SET access_disabled_at = disabled_at,
          access_disabled_by_offboarding_request = NEW.id
      WHERE id = NEW.school_id
        AND (
          access_disabled_by_offboarding_request IS NULL
          OR access_disabled_by_offboarding_request = NEW.id
        );
    ELSE
      UPDATE public.districts
      SET access_disabled_at = disabled_at,
          access_disabled_by_offboarding_request = NEW.id
      WHERE id = NEW.district_id
        AND (
          access_disabled_by_offboarding_request IS NULL
          OR access_disabled_by_offboarding_request = NEW.id
        );

      UPDATE public.schools
      SET access_disabled_at = disabled_at,
          access_disabled_by_offboarding_request = NEW.id
      WHERE district_id = NEW.district_id
        AND (
          access_disabled_by_offboarding_request IS NULL
          OR access_disabled_by_offboarding_request = NEW.id
        );
    END IF;
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.schools
    SET access_disabled_at = NULL,
        access_disabled_by_offboarding_request = NULL
    WHERE access_disabled_by_offboarding_request = NEW.id;

    UPDATE public.districts
    SET access_disabled_at = NULL,
        access_disabled_by_offboarding_request = NULL
    WHERE access_disabled_by_offboarding_request = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enforce_tenant_access_marker_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_disabled_tenant_final_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_disabled_profile_final_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_offboarding_access_marker()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_tenant_access_marker_integrity() IS
  'Prevents direct removal, replacement, or cross-tenant reuse of an approved offboarding access marker.';
COMMENT ON COLUMN public.legal_holds.district_id IS
  'Immutable audit scope UUID; intentionally not a foreign key so the hold record can outlive tenant deletion.';
COMMENT ON COLUMN public.legal_holds.school_id IS
  'Immutable audit scope UUID; intentionally not a foreign key so the hold record can outlive tenant deletion.';

COMMIT;
