-- Provide a short-lived, service-role-only pilot reset operation. A follow-up
-- migration removes this function after the production reset is verified.

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_platform_for_pilot(
  requested_confirmation TEXT
)
RETURNS JSONB AS $$
DECLARE
  preserved_super_admin_count INTEGER;
  reset_actor_id UUID;
  before_counts JSONB;
  after_counts JSONB;
BEGIN
  IF requested_confirmation IS DISTINCT FROM 'RESET_TEST_DATA_FOR_PILOT' THEN
    RAISE EXCEPTION 'Exact pilot reset confirmation is required';
  END IF;

  SELECT count(*)
  INTO preserved_super_admin_count
  FROM public.profiles
  WHERE role = 'super_admin';

  IF preserved_super_admin_count < 1 THEN
    RAISE EXCEPTION 'Pilot reset requires at least one platform super administrator';
  END IF;

  SELECT id
  INTO reset_actor_id
  FROM public.profiles
  WHERE role = 'super_admin'
  ORDER BY created_at, id
  LIMIT 1;

  before_counts := jsonb_build_object(
    'districts', (SELECT count(*) FROM public.districts),
    'schools', (SELECT count(*) FROM public.schools),
    'auth_users', (SELECT count(*) FROM auth.users),
    'profiles', (SELECT count(*) FROM public.profiles),
    'super_admins', preserved_super_admin_count,
    'clubs', (SELECT count(*) FROM public.clubs)
  );

  -- Remove tenant workflow evidence and temporary support access first so no
  -- test-only legal hold, deletion request, or support session survives.
  DELETE FROM public.platform_support_access_log WHERE TRUE;
  DELETE FROM public.platform_support_sessions WHERE TRUE;
  DELETE FROM public.tenant_offboarding_profile_snapshots WHERE TRUE;
  DELETE FROM public.tenant_offboarding_events WHERE TRUE;
  DELETE FROM public.tenant_offboarding_requests WHERE TRUE;
  DELETE FROM public.legal_holds WHERE TRUE;
  DELETE FROM public.account_deletion_requests WHERE TRUE;
  DELETE FROM public.account_deletion_executions WHERE TRUE;

  -- Clear all pilot-test communication, metrics, rate limits, and delivery
  -- history. Retention-run history is operational health evidence and remains.
  DELETE FROM public.digest_deliveries WHERE TRUE;
  DELETE FROM public.email_outbox WHERE TRUE;
  DELETE FROM public.notifications WHERE TRUE;
  DELETE FROM public.feedback WHERE TRUE;
  DELETE FROM public.analytics_events WHERE TRUE;
  DELETE FROM public.signup_attempts WHERE TRUE;
  DELETE FROM public.request_attempts WHERE TRUE;

  -- Remove school-specific learning, participation, and publishing records in
  -- dependency order. The reusable starter catalog is a database function and
  -- trigger, not a global row set, so it is intentionally unaffected.
  DELETE FROM public.club_assignment_student_copies WHERE TRUE;
  DELETE FROM public.club_submission_attachments WHERE TRUE;
  DELETE FROM public.club_assignment_attachments WHERE TRUE;
  DELETE FROM public.club_assignment_submissions WHERE TRUE;
  DELETE FROM public.coursework_upload_intents WHERE TRUE;
  DELETE FROM public.club_assignments WHERE TRUE;
  DELETE FROM public.club_event_attendance WHERE TRUE;
  DELETE FROM public.event_rsvps WHERE TRUE;
  DELETE FROM public.opportunity_signups WHERE TRUE;
  DELETE FROM public.bookmarks WHERE TRUE;
  DELETE FROM public.approval_requests WHERE TRUE;
  DELETE FROM public.interest_forms WHERE TRUE;
  DELETE FROM public.service_hours WHERE TRUE;
  DELETE FROM public.events WHERE TRUE;
  DELETE FROM public.opportunities WHERE TRUE;
  DELETE FROM public.workshops WHERE TRUE;
  DELETE FROM public.club_announcements WHERE TRUE;
  DELETE FROM public.club_resources WHERE TRUE;
  DELETE FROM public.club_member_bans WHERE TRUE;
  DELETE FROM public.club_memberships WHERE TRUE;
  DELETE FROM public.clubs WHERE TRUE;

  -- Platform owners survive the reset without a stale tenant scope. Deleting
  -- the remaining Auth users cascades through profiles and personal settings.
  UPDATE public.profiles
  SET school_id = NULL,
      district_id = NULL,
      updated_at = NOW()
  WHERE role = 'super_admin';

  DELETE FROM auth.users auth_user
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth_user.id
      AND profile.role = 'super_admin'
  );

  DELETE FROM public.profiles WHERE role <> 'super_admin';
  DELETE FROM public.schools WHERE TRUE;
  DELETE FROM public.districts WHERE TRUE;

  -- Discard test-era administrative logs, then leave one non-PII record of the
  -- production reset itself for accountability.
  DELETE FROM public.admin_audit_log WHERE TRUE;
  INSERT INTO public.admin_audit_log (
    actor_user_id,
    action,
    entity_type,
    old_data,
    new_data
  ) VALUES (
    reset_actor_id,
    'pilot_data_reset',
    'platform',
    before_counts,
    jsonb_build_object(
      'preserved_super_admins', preserved_super_admin_count,
      'starter_catalog_preserved', TRUE
    )
  );

  after_counts := jsonb_build_object(
    'districts', (SELECT count(*) FROM public.districts),
    'schools', (SELECT count(*) FROM public.schools),
    'auth_users', (SELECT count(*) FROM auth.users),
    'profiles', (SELECT count(*) FROM public.profiles),
    'super_admins', (SELECT count(*) FROM public.profiles WHERE role = 'super_admin'),
    'clubs', (SELECT count(*) FROM public.clubs)
  );

  IF (after_counts->>'auth_users')::INTEGER <> preserved_super_admin_count
    OR (after_counts->>'profiles')::INTEGER <> preserved_super_admin_count
    OR (after_counts->>'super_admins')::INTEGER <> preserved_super_admin_count
    OR (after_counts->>'districts')::INTEGER <> 0
    OR (after_counts->>'schools')::INTEGER <> 0
    OR (after_counts->>'clubs')::INTEGER <> 0
  THEN
    RAISE EXCEPTION 'Pilot reset verification failed: %', after_counts;
  END IF;

  RETURN jsonb_build_object(
    'before', before_counts,
    'after', after_counts,
    'starter_catalog_preserved', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.reset_platform_for_pilot(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_platform_for_pilot(TEXT)
  TO service_role;

COMMENT ON FUNCTION public.reset_platform_for_pilot(TEXT) IS
  'Short-lived service-role operation that removes pre-pilot tenant data while preserving platform super-admin accounts and starter-catalog generation.';

COMMIT;
