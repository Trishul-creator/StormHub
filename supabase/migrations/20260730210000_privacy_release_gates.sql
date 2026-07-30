BEGIN;

-- Preserve the promised support audit trail when an administrator account is
-- deleted. The actor becomes anonymous; the immutable event remains.
ALTER TABLE public.platform_support_sessions
  DROP CONSTRAINT IF EXISTS platform_support_sessions_actor_user_id_fkey,
  ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE public.platform_support_sessions
  ADD CONSTRAINT platform_support_sessions_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.platform_support_sessions
  DROP CONSTRAINT IF EXISTS platform_support_sessions_school_id_fkey,
  ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.platform_support_sessions
  ADD CONSTRAINT platform_support_sessions_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;

ALTER TABLE public.platform_support_access_log
  DROP CONSTRAINT IF EXISTS platform_support_access_log_actor_user_id_fkey,
  ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE public.platform_support_access_log
  ADD CONSTRAINT platform_support_access_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.platform_support_access_log
  DROP CONSTRAINT IF EXISTS platform_support_access_log_school_id_fkey,
  DROP CONSTRAINT IF EXISTS platform_support_access_log_session_id_fkey,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.platform_support_access_log
  ADD CONSTRAINT platform_support_access_log_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD CONSTRAINT platform_support_access_log_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.platform_support_sessions(id) ON DELETE SET NULL;

-- The school-delete audit trigger writes the deleted UUID after the row is
-- gone. Keep that immutable evidence identifier instead of retaining a tenant
-- FK that makes the verified purge impossible.
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_school_id_fkey;

-- An explicit suspension marker distinguishes an offboarded tenant from a
-- school that is merely private/inactive for discovery purposes.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS access_disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_disabled_by_offboarding_request UUID;
ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS access_disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_disabled_by_offboarding_request UUID;

CREATE INDEX IF NOT EXISTS idx_schools_access_disabled
  ON public.schools(access_disabled_at)
  WHERE access_disabled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_districts_access_disabled
  ON public.districts(access_disabled_at)
  WHERE access_disabled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_profile_tenant_active(target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    LEFT JOIN public.schools school ON school.id = profile.school_id
    LEFT JOIN public.districts district
      ON district.id = COALESCE(profile.district_id, school.district_id)
    WHERE profile.id = target_user_id
      AND profile.account_status = 'active'
      AND (
        profile.role = 'super_admin'
        OR (
          (profile.school_id IS NULL OR school.access_disabled_at IS NULL)
          AND (COALESCE(profile.district_id, school.district_id) IS NULL
            OR district.access_disabled_at IS NULL)
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_profile_tenant_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_profile_tenant_active(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT public.is_profile_tenant_active(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_view_school(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    JOIN public.schools school ON school.id = school_uuid
    LEFT JOIN public.districts district ON district.id = school.district_id
    WHERE actor.id = auth.uid()
      AND (
        (actor.role = 'super_admin' AND actor.account_status = 'active')
        OR (
          public.is_profile_tenant_active(actor.id)
          AND school.access_disabled_at IS NULL
          AND (school.district_id IS NULL OR district.access_disabled_at IS NULL)
          AND (
            (actor.role = 'district_admin' AND actor.district_id = school.district_id)
            OR (actor.role IN ('student', 'teacher', 'admin') AND actor.school_id = school.id)
          )
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_district(district_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles actor
    LEFT JOIN public.districts district ON district.id = district_uuid
    WHERE actor.id = auth.uid()
      AND (
        (actor.role = 'super_admin' AND actor.account_status = 'active')
        OR (
          actor.role = 'district_admin'
          AND actor.district_id = district_uuid
          AND district.access_disabled_at IS NULL
          AND public.is_profile_tenant_active(actor.id)
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_school(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles actor
    JOIN public.schools school ON school.id = school_uuid
    LEFT JOIN public.districts district ON district.id = school.district_id
    WHERE actor.id = auth.uid()
      AND (
        (actor.role = 'super_admin' AND actor.account_status = 'active')
        OR (
          public.is_profile_tenant_active(actor.id)
          AND school.access_disabled_at IS NULL
          AND (school.district_id IS NULL OR district.access_disabled_at IS NULL)
          AND (
            (actor.role = 'district_admin' AND actor.district_id = school.district_id)
            OR (actor.role = 'admin' AND actor.school_id = school.id)
          )
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs club
    WHERE club.id = club_uuid
      AND public.can_admin_school(club.school_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_tenant_active(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs club
    JOIN public.schools school ON school.id = club.school_id
    LEFT JOIN public.districts district ON district.id = school.district_id
    WHERE club.id = club_uuid
      AND school.access_disabled_at IS NULL
      AND (school.district_id IS NULL OR district.access_disabled_at IS NULL)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_club_tenant_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_tenant_active(UUID)
  TO authenticated, service_role;

-- Own-row policies must not keep an already-authenticated tenant user alive
-- after offboarding approval. A restrictive policy is ANDed with every
-- existing table-specific policy. Profiles remain readable so the suspended
-- account-status screen can explain the block.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'districts',
    'schools',
    'school_settings',
    'clubs',
    'club_memberships',
    'club_announcements',
    'club_resources',
    'opportunities',
    'events',
    'event_rsvps',
    'bookmarks',
    'workshops',
    'service_hours',
    'interest_forms',
    'approval_requests',
    'analytics_events',
    'feedback',
    'notifications',
    'notification_preferences',
    'email_outbox',
    'opportunity_signups',
    'club_assignments',
    'club_assignment_submissions',
    'club_assignment_attachments',
    'club_submission_attachments',
    'club_assignment_student_copies',
    'club_event_attendance'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_access_gate ON public.%I',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_access_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_profile_tenant_active(auth.uid())) WITH CHECK (public.is_profile_tenant_active(auth.uid()))',
      table_name
    );
  END LOOP;
END;
$$;

-- Legal holds are intentionally conservative: any matching active hold pauses
-- automatic deletion. Physical tenant purge remains a two-person operator task.
CREATE TABLE IF NOT EXISTS public.legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'district', 'school')),
  -- Immutable scope identifiers intentionally outlive a later verified tenant
  -- purge, just like the offboarding evidence tables.
  district_id UUID,
  school_id UUID,
  category TEXT NOT NULL DEFAULT 'all'
    CHECK (category IN ('all', 'operational', 'communications', 'support', 'analytics', 'audit')),
  reason TEXT NOT NULL CHECK (char_length(BTRIM(reason)) BETWEEN 10 AND 2000),
  placed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  released_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  released_at TIMESTAMPTZ,
  release_reason TEXT CHECK (release_reason IS NULL OR char_length(BTRIM(release_reason)) BETWEEN 10 AND 2000),
  CHECK (
    (scope_type = 'global' AND district_id IS NULL AND school_id IS NULL)
    OR (scope_type = 'district' AND district_id IS NOT NULL AND school_id IS NULL)
    OR (scope_type = 'school' AND district_id IS NOT NULL AND school_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_active_scope
  ON public.legal_holds(scope_type, district_id, school_id, category)
  WHERE released_at IS NULL;

ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.legal_holds TO authenticated;
GRANT ALL ON TABLE public.legal_holds TO service_role;

CREATE POLICY legal_holds_platform_read ON public.legal_holds
  FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.has_active_legal_hold(
  target_district_id UUID DEFAULT NULL,
  target_school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_holds hold
    WHERE hold.released_at IS NULL
      AND (hold.expires_at IS NULL OR hold.expires_at > NOW())
      AND (
        hold.scope_type = 'global'
        OR (hold.scope_type = 'district' AND hold.district_id = target_district_id)
        OR (hold.scope_type = 'school' AND hold.school_id = target_school_id)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.has_active_legal_hold(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_legal_hold(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.has_any_active_legal_hold()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_holds hold
    WHERE hold.released_at IS NULL
      AND (hold.expires_at IS NULL OR hold.expires_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.has_any_active_legal_hold() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_active_legal_hold() TO service_role;

CREATE OR REPLACE FUNCTION public.place_legal_hold(
  requested_scope_type TEXT,
  requested_district_id UUID,
  requested_school_id UUID,
  requested_category TEXT,
  requested_reason TEXT,
  requested_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  hold_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  INSERT INTO public.legal_holds (
    scope_type, district_id, school_id, category, reason, placed_by, expires_at
  ) VALUES (
    requested_scope_type,
    requested_district_id,
    requested_school_id,
    requested_category,
    BTRIM(requested_reason),
    auth.uid(),
    requested_expires_at
  )
  RETURNING id INTO hold_id;
  RETURN hold_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.release_legal_hold(
  target_hold_id UUID,
  requested_release_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF char_length(BTRIM(COALESCE(requested_release_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Explain why the hold can be released';
  END IF;
  UPDATE public.legal_holds
  SET released_by = auth.uid(),
      released_at = NOW(),
      release_reason = BTRIM(requested_release_reason)
  WHERE id = target_hold_id AND released_at IS NULL;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.place_legal_hold(TEXT, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_legal_hold(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_legal_hold(TEXT, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_legal_hold(UUID, TEXT)
  TO authenticated, service_role;

ALTER TABLE public.data_retention_runs
  ADD COLUMN IF NOT EXISTS skipped_reason TEXT;

CREATE OR REPLACE FUNCTION public.delete_retention_batch(
  target_table TEXT,
  target_before TIMESTAMPTZ,
  target_exclude_id UUID DEFAULT NULL,
  target_limit INTEGER DEFAULT 500
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  statement TEXT;
  extra_predicate TEXT := '';
  timestamp_column TEXT;
BEGIN
  timestamp_column := CASE target_table
    WHEN 'signup_attempts' THEN 'created_at'
    WHEN 'request_attempts' THEN 'created_at'
    WHEN 'digest_deliveries' THEN 'created_at'
    WHEN 'email_outbox' THEN 'created_at'
    WHEN 'notifications' THEN 'created_at'
    WHEN 'feedback' THEN 'resolved_at'
    WHEN 'account_deletion_requests' THEN 'reviewed_at'
    WHEN 'analytics_events' THEN 'created_at'
    WHEN 'admin_audit_log' THEN 'occurred_at'
    WHEN 'platform_support_sessions' THEN 'started_at'
    WHEN 'data_retention_runs' THEN 'started_at'
    ELSE NULL
  END;
  IF timestamp_column IS NULL THEN
    RAISE EXCEPTION 'Unsupported retention table';
  END IF;
  IF target_table = 'feedback' THEN
    extra_predicate := ' AND status = ''resolved''';
  ELSIF target_table = 'account_deletion_requests' THEN
    extra_predicate := ' AND status IN (''completed'', ''rejected'')';
  ELSIF target_table = 'data_retention_runs' AND target_exclude_id IS NOT NULL THEN
    extra_predicate := ' AND id <> $3';
  END IF;

  statement := format(
    'WITH doomed AS (
       SELECT id FROM public.%I
       WHERE %I < $1 %s
       ORDER BY %I
       FOR UPDATE SKIP LOCKED
       LIMIT $2
     )
     DELETE FROM public.%I target
     USING doomed
     WHERE target.id = doomed.id',
    target_table,
    timestamp_column,
    extra_predicate,
    timestamp_column,
    target_table
  );
  EXECUTE statement
    USING target_before, LEAST(GREATEST(target_limit, 1), 500), target_exclude_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.delete_retention_batch(TEXT, TIMESTAMPTZ, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_retention_batch(TEXT, TIMESTAMPTZ, UUID, INTEGER)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.account_deletion_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL UNIQUE,
  school_id UUID,
  district_id UUID,
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'auth_delete_failed', 'completed')),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auth_deleted_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.account_deletion_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_executions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.account_deletion_executions TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_user_account_deletion(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  target_profile public.profiles%ROWTYPE;
  target_district_id UUID;
  execution_id UUID;
BEGIN
  SELECT * INTO target_profile
  FROM public.profiles
  WHERE id = target_user_id
  FOR UPDATE;
  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  target_district_id := target_profile.district_id;
  IF target_district_id IS NULL AND target_profile.school_id IS NOT NULL THEN
    SELECT school.district_id
    INTO target_district_id
    FROM public.schools school
    WHERE school.id = target_profile.school_id;
  END IF;
  IF public.has_active_legal_hold(target_district_id, target_profile.school_id) THEN
    RAISE EXCEPTION 'An active legal hold blocks account deletion';
  END IF;

  UPDATE public.profiles SET account_status = 'deactivated', updated_at = NOW()
  WHERE id = target_user_id;
  UPDATE public.club_assignments SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.club_assignment_attachments SET uploaded_by = NULL WHERE uploaded_by = target_user_id;
  UPDATE public.club_announcements SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.club_resources SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.opportunities SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.events SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.workshops SET host_user_id = NULL WHERE host_user_id = target_user_id;
  UPDATE public.service_hours SET approved_by = NULL WHERE approved_by = target_user_id;
  UPDATE public.approval_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  UPDATE public.analytics_events SET user_id = NULL WHERE user_id = target_user_id;
  UPDATE public.feedback
  SET user_id = NULL,
      name = 'Deleted user',
      email = NULL,
      message = '[Message removed when the account was deleted.]'
  WHERE user_id = target_user_id;
  UPDATE public.email_outbox
  SET recipient_user_id = NULL,
      recipient_email = 'deleted-' || target_user_id::TEXT || '@invalid.local',
      body = '[Message removed when the account was deleted.]',
      status = 'failed',
      retryable = FALSE,
      claimed_at = NULL,
      claim_token = NULL,
      next_attempt_at = NULL,
      error_message = 'Recipient account deleted.'
  WHERE recipient_user_id = target_user_id;
  IF target_profile.email IS NOT NULL THEN
    UPDATE public.interest_forms
    SET full_name = 'Deleted user',
        email = 'deleted-' || target_user_id::TEXT || '@invalid.local',
        grade_level = NULL,
        message = NULL
    WHERE lower(email) = lower(target_profile.email);
  END IF;
  DELETE FROM public.approval_requests WHERE submitted_by = target_user_id;

  INSERT INTO public.account_deletion_executions (
    target_user_id, school_id, district_id, status, prepared_at, updated_at
  ) VALUES (
    target_user_id, target_profile.school_id, target_district_id, 'prepared', NOW(), NOW()
  )
  ON CONFLICT (target_user_id) DO UPDATE
    SET status = 'prepared',
        last_error = NULL,
        updated_at = NOW()
  RETURNING id INTO execution_id;
  RETURN execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.prepare_user_account_deletion(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_user_account_deletion(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.block_suspended_tenant_publish()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    (TG_TABLE_NAME = 'club_assignments' AND NEW.status = 'published')
    OR (TG_TABLE_NAME = 'club_announcements' AND NEW.status = 'approved')
  ) AND NOT public.is_club_tenant_active(NEW.club_id) THEN
    RAISE EXCEPTION 'Content cannot be published for an offboarded tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS assignments_block_suspended_publish
  ON public.club_assignments;
CREATE TRIGGER assignments_block_suspended_publish
  BEFORE INSERT OR UPDATE OF status ON public.club_assignments
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_tenant_publish();

DROP TRIGGER IF EXISTS announcements_block_suspended_publish
  ON public.club_announcements;
CREATE TRIGGER announcements_block_suspended_publish
  BEFORE INSERT OR UPDATE OF status ON public.club_announcements
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_tenant_publish();

CREATE OR REPLACE FUNCTION public.enforce_offboarding_release_gates()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();

  IF actor_role = 'district_admin'
    AND (
      NEW.scope_type <> 'school'
      OR NEW.status NOT IN ('under_review', 'export_ready', 'rejected')
    )
  THEN
    RAISE EXCEPTION 'Only a platform administrator can approve or complete offboarding';
  END IF;
  IF NEW.status IN ('approved', 'scheduled', 'completed')
    AND actor_role IS DISTINCT FROM 'super_admin'
  THEN
    RAISE EXCEPTION 'Only a platform administrator can approve or complete offboarding';
  END IF;
  IF NEW.status = 'completed'
    AND (NEW.scheduled_purge_at IS NULL OR NEW.scheduled_purge_at > NOW())
  THEN
    RAISE EXCEPTION 'The scheduled deletion window has not been reached';
  END IF;
  IF NEW.status = 'completed'
    AND char_length(BTRIM(COALESCE(NEW.completion_reference, ''))) < 20
  THEN
    RAISE EXCEPTION 'Record a meaningful deletion evidence reference';
  END IF;
  IF NEW.status IN ('scheduled', 'completed')
    AND public.has_active_legal_hold(NEW.district_id, NEW.school_id)
  THEN
    RAISE EXCEPTION 'An active legal hold blocks deletion scheduling or completion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.enforce_offboarding_release_gates()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tenant_offboarding_release_gates
  ON public.tenant_offboarding_requests;
CREATE TRIGGER tenant_offboarding_release_gates
  BEFORE UPDATE OF status ON public.tenant_offboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offboarding_release_gates();

CREATE OR REPLACE FUNCTION public.sync_offboarding_access_marker()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.scope_type = 'school' THEN
      UPDATE public.schools
      SET access_disabled_at = NOW(),
          access_disabled_by_offboarding_request = NEW.id
      WHERE id = NEW.school_id
        AND (
          access_disabled_by_offboarding_request IS NULL
          OR access_disabled_by_offboarding_request = NEW.id
        );
    ELSE
      UPDATE public.districts
      SET access_disabled_at = NOW(),
          access_disabled_by_offboarding_request = NEW.id
      WHERE id = NEW.district_id
        AND (
          access_disabled_by_offboarding_request IS NULL
          OR access_disabled_by_offboarding_request = NEW.id
        );
      UPDATE public.schools
      SET access_disabled_at = NOW(),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tenant_offboarding_access_marker
  ON public.tenant_offboarding_requests;
CREATE TRIGGER tenant_offboarding_access_marker
  AFTER UPDATE OF status ON public.tenant_offboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_offboarding_access_marker();

-- Backfill workflows that reached a terminal access-disabled state before this
-- release. School-specific evidence wins over a later district-wide marker.
WITH latest_school_request AS (
  SELECT DISTINCT ON (request.school_id)
    request.school_id,
    request.id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'school'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.school_id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) DESC,
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
    request.district_id,
    request.id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'district'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.district_id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) DESC,
    request.id DESC
)
UPDATE public.districts district
SET access_disabled_at = request.disabled_at,
    access_disabled_by_offboarding_request = request.id
FROM latest_district_request request
WHERE district.id = request.district_id
  AND district.access_disabled_by_offboarding_request IS NULL;

WITH latest_district_request AS (
  SELECT DISTINCT ON (request.district_id)
    request.district_id,
    request.id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) AS disabled_at
  FROM public.tenant_offboarding_requests request
  WHERE request.scope_type = 'district'
    AND request.status IN ('approved', 'scheduled', 'completed')
  ORDER BY
    request.district_id,
    COALESCE(request.approved_at, request.updated_at, request.requested_at) DESC,
    request.id DESC
)
UPDATE public.schools school
SET access_disabled_at = request.disabled_at,
    access_disabled_by_offboarding_request = request.id
FROM latest_district_request request
WHERE school.district_id = request.district_id
  AND school.access_disabled_by_offboarding_request IS NULL;

CREATE OR REPLACE FUNCTION public.guard_tenant_access_marker()
RETURNS TRIGGER AS $$
DECLARE
  request public.tenant_offboarding_requests%ROWTYPE;
  row_id UUID := NEW.id;
  row_district_id UUID;
BEGIN
  IF NEW.access_disabled_at IS NOT DISTINCT FROM OLD.access_disabled_at
    AND NEW.access_disabled_by_offboarding_request
      IS NOT DISTINCT FROM OLD.access_disabled_by_offboarding_request
  THEN
    RETURN NEW;
  END IF;

  IF NEW.access_disabled_at IS NULL
    AND NEW.access_disabled_by_offboarding_request IS NULL
  THEN
    SELECT * INTO request
    FROM public.tenant_offboarding_requests
    WHERE id = OLD.access_disabled_by_offboarding_request;
    IF request.id IS NULL OR request.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Tenant access markers are controlled by the offboarding workflow';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.access_disabled_at IS NULL
    OR NEW.access_disabled_by_offboarding_request IS NULL
  THEN
    RAISE EXCEPTION 'Tenant access markers must be set or cleared together';
  END IF;

  SELECT * INTO request
  FROM public.tenant_offboarding_requests
  WHERE id = NEW.access_disabled_by_offboarding_request;
  IF request.id IS NULL
    OR request.status NOT IN ('approved', 'scheduled', 'completed')
  THEN
    RAISE EXCEPTION 'Tenant access markers require an approved offboarding request';
  END IF;

  IF TG_TABLE_NAME = 'schools' THEN
    row_district_id := NEW.district_id;
    IF NOT (
      (request.scope_type = 'school' AND request.school_id = row_id)
      OR (
        request.scope_type = 'district'
        AND request.district_id = row_district_id
      )
    ) THEN
      RAISE EXCEPTION 'The offboarding request does not cover this school';
    END IF;
  ELSIF request.scope_type <> 'district' OR request.district_id <> row_id THEN
    RAISE EXCEPTION 'The offboarding request does not cover this district';
  END IF;

  IF OLD.access_disabled_by_offboarding_request IS NOT NULL
    AND OLD.access_disabled_by_offboarding_request
      IS DISTINCT FROM NEW.access_disabled_by_offboarding_request
  THEN
    RAISE EXCEPTION 'An existing tenant access marker cannot be overwritten';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS schools_guard_access_marker ON public.schools;
CREATE TRIGGER schools_guard_access_marker
  BEFORE UPDATE OF access_disabled_at, access_disabled_by_offboarding_request
  ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_access_marker();

DROP TRIGGER IF EXISTS districts_guard_access_marker ON public.districts;
CREATE TRIGGER districts_guard_access_marker
  BEFORE UPDATE OF access_disabled_at, access_disabled_by_offboarding_request
  ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_access_marker();

-- Tenant rows are deleted only by the service-role purge procedure after the
-- durable offboarding evidence is complete. Authenticated administration is
-- intentionally recoverable.
REVOKE DELETE ON TABLE public.schools, public.districts FROM authenticated;

CREATE OR REPLACE FUNCTION public.block_authenticated_tenant_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant deletion requires the verified service-role purge workflow';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS schools_block_authenticated_delete ON public.schools;
CREATE TRIGGER schools_block_authenticated_delete
  BEFORE DELETE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.block_authenticated_tenant_delete();

DROP TRIGGER IF EXISTS districts_block_authenticated_delete ON public.districts;
CREATE TRIGGER districts_block_authenticated_delete
  BEFORE DELETE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.block_authenticated_tenant_delete();

CREATE OR REPLACE FUNCTION public.enforce_disabled_tenant_final_state()
RETURNS TRIGGER AS $$
DECLARE
  current_account_status TEXT;
  current_access_disabled_at TIMESTAMPTZ;
  current_is_active BOOLEAN;
  current_is_public BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    SELECT profile.account_status
    INTO current_account_status
    FROM public.profiles profile
    WHERE profile.id = NEW.id;
    IF current_account_status = 'active'
      AND NOT public.is_profile_tenant_active(NEW.id)
    THEN
      RAISE EXCEPTION 'Accounts in an offboarded tenant cannot be reactivated';
    END IF;
  ELSIF TG_TABLE_NAME = 'schools' THEN
    SELECT school.access_disabled_at, school.is_active, school.is_public
    INTO current_access_disabled_at, current_is_active, current_is_public
    FROM public.schools school
    WHERE school.id = NEW.id;
    IF current_access_disabled_at IS NOT NULL
      AND (current_is_active IS TRUE OR current_is_public IS TRUE)
    THEN
      RAISE EXCEPTION 'An offboarded school cannot be reactivated';
    END IF;
  ELSE
    SELECT district.access_disabled_at, district.is_active
    INTO current_access_disabled_at, current_is_active
    FROM public.districts district
    WHERE district.id = NEW.id;
    IF current_access_disabled_at IS NOT NULL AND current_is_active IS TRUE THEN
      RAISE EXCEPTION 'An offboarded district cannot be reactivated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_disabled_tenant_final_state ON public.profiles;
CREATE CONSTRAINT TRIGGER profiles_disabled_tenant_final_state
  AFTER UPDATE OF account_status, school_id, district_id ON public.profiles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_disabled_tenant_final_state();

DROP TRIGGER IF EXISTS schools_disabled_tenant_final_state ON public.schools;
CREATE CONSTRAINT TRIGGER schools_disabled_tenant_final_state
  AFTER UPDATE OF is_active, is_public, access_disabled_at ON public.schools
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_disabled_tenant_final_state();

DROP TRIGGER IF EXISTS districts_disabled_tenant_final_state ON public.districts;
CREATE CONSTRAINT TRIGGER districts_disabled_tenant_final_state
  AFTER UPDATE OF is_active, access_disabled_at ON public.districts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_disabled_tenant_final_state();

-- Cancel queued user mail when the account or tenant is no longer eligible.
CREATE OR REPLACE FUNCTION public.claim_email_outbox(
  target_worker_token UUID,
  target_limit INTEGER DEFAULT 50,
  target_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  attempt_count INTEGER
) AS $$
BEGIN
  IF target_worker_token IS NULL THEN
    RAISE EXCEPTION 'A worker token is required';
  END IF;

  UPDATE public.email_outbox queue
  SET status = 'failed',
      retryable = FALSE,
      error_message = 'Recipient account or tenant is unavailable.',
      next_attempt_at = NULL,
      claimed_at = NULL,
      claim_token = NULL
  WHERE queue.recipient_user_id IS NOT NULL
    AND queue.status IN ('pending', 'failed')
    AND NOT public.is_profile_tenant_active(queue.recipient_user_id);

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id
    FROM public.email_outbox queue
    WHERE queue.status IN ('pending', 'failed')
      AND queue.retryable = TRUE
      AND queue.attempt_count < 5
      AND (target_id IS NULL OR queue.id = target_id)
      AND (queue.next_attempt_at IS NULL OR queue.next_attempt_at <= NOW())
      AND (queue.claimed_at IS NULL OR queue.claimed_at < NOW() - INTERVAL '10 minutes')
      AND (
        queue.recipient_user_id IS NULL
        OR public.is_profile_tenant_active(queue.recipient_user_id)
      )
    ORDER BY queue.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(target_limit, 1), 100)
  )
  UPDATE public.email_outbox queue
  SET claimed_at = NOW(),
      claim_token = target_worker_token,
      last_attempt_at = NOW(),
      attempt_count = queue.attempt_count + 1
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.id, queue.recipient_email, queue.subject, queue.body, queue.attempt_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_email_outbox(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(UUID, INTEGER, UUID) TO service_role;

COMMIT;
