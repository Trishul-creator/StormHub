-- Serialize legal-hold transitions with destructive execution leases. Advisory
-- locks protect the decision point; durable rows keep the barrier in place
-- while retention and account-deletion work continues outside the transaction.

BEGIN;

ALTER TABLE public.account_deletion_executions
  DROP CONSTRAINT IF EXISTS account_deletion_executions_status_check;
ALTER TABLE public.account_deletion_executions
  ADD CONSTRAINT account_deletion_executions_status_check
  CHECK (status IN ('prepared', 'failed', 'auth_delete_failed', 'completed'));

-- Older application versions used auth_delete_failed before the external
-- cleanup lease had a dedicated finalizer. Normalize existing rows; a rolling
-- old deployment can still write that value, so the barrier below treats a
-- recent row as in-flight and expires it after the same conservative window.
UPDATE public.account_deletion_executions
SET status = 'failed',
    updated_at = NOW()
WHERE status = 'auth_delete_failed';

CREATE INDEX IF NOT EXISTS idx_account_deletion_executions_prepared_scope
  ON public.account_deletion_executions(district_id, school_id)
  WHERE status = 'prepared';

-- Finalized tenant exports and purge approvals depend on stable district tree
-- membership. Status transitions and school membership writes use the same
-- per-district advisory key, making the freeze decision race-free even for
-- service-role provisioning calls.
CREATE OR REPLACE FUNCTION public.lock_tenant_offboarding_district_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.district_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('district:' || NEW.district_id::TEXT, 0)
    );
  ELSIF NEW.school_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('school:' || NEW.school_id::TEXT, 0)
    );
  ELSE
    RAISE EXCEPTION 'Offboarding scope requires a district or school lock key';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tenant_offboarding_00_lock_district_transition
  ON public.tenant_offboarding_requests;
CREATE TRIGGER tenant_offboarding_00_lock_district_transition
  BEFORE INSERT OR UPDATE OF status ON public.tenant_offboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_tenant_offboarding_district_transition();

CREATE OR REPLACE FUNCTION public.enforce_offboarding_district_tree_freeze()
RETURNS TRIGGER AS $$
DECLARE
  source_district_id UUID;
  source_lock_key BIGINT;
  target_lock_key BIGINT;
  selected_lock_key BIGINT;
BEGIN
  source_district_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.district_id ELSE NULL END;

  IF TG_OP = 'UPDATE'
    AND NEW.district_id IS NOT DISTINCT FROM source_district_id
  THEN
    RETURN NEW;
  END IF;

  source_lock_key := CASE
    WHEN TG_OP <> 'UPDATE' THEN NULL
    WHEN source_district_id IS NOT NULL
      THEN hashtextextended('district:' || source_district_id::TEXT, 0)
    ELSE hashtextextended('school:' || OLD.id::TEXT, 0)
  END;
  target_lock_key := CASE
    WHEN NEW.district_id IS NOT NULL
      THEN hashtextextended('district:' || NEW.district_id::TEXT, 0)
    ELSE hashtextextended('school:' || NEW.id::TEXT, 0)
  END;

  -- Lock both sides in key order so two concurrent cross-district moves cannot
  -- deadlock while each protects its source and destination snapshots.
  FOR selected_lock_key IN
    SELECT DISTINCT lock_key
    FROM unnest(ARRAY[source_lock_key, target_lock_key]) AS lock_key
    WHERE lock_key IS NOT NULL
    ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(selected_lock_key);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_offboarding_requests request
    WHERE (
        (
          request.district_id IS NOT NULL
          AND request.district_id IN (source_district_id, NEW.district_id)
        )
        OR (
          request.district_id IS NULL
          AND request.school_id = NEW.id
        )
      )
      AND request.status IN ('export_ready', 'approved', 'scheduled')
  ) THEN
    RAISE EXCEPTION
      'District school membership is frozen by an active offboarding export or purge';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS schools_enforce_offboarding_district_tree_freeze
  ON public.schools;
CREATE TRIGGER schools_enforce_offboarding_district_tree_freeze
  BEFORE INSERT OR UPDATE OF district_id ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_offboarding_district_tree_freeze();

-- Independent schools have no district. A school hold is still valid for them;
-- the placement RPC below always derives the canonical district from the
-- selected school rather than trusting caller-supplied scope metadata.
ALTER TABLE public.legal_holds
  DROP CONSTRAINT IF EXISTS legal_holds_check;
ALTER TABLE public.legal_holds
  ADD CONSTRAINT legal_holds_scope_check
  CHECK (
    (scope_type = 'global' AND district_id IS NULL AND school_id IS NULL)
    OR (scope_type = 'district' AND district_id IS NOT NULL AND school_id IS NULL)
    OR (scope_type = 'school' AND school_id IS NOT NULL)
  );

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
  canonical_district_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  IF requested_scope_type NOT IN ('global', 'district', 'school') THEN
    RAISE EXCEPTION 'Choose a global, district, or school legal-hold scope';
  END IF;
  IF requested_category NOT IN (
    'all', 'operational', 'communications', 'support', 'analytics', 'audit'
  ) THEN
    RAISE EXCEPTION 'Choose a supported legal-hold category';
  END IF;
  IF char_length(BTRIM(COALESCE(requested_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Provide a legal-hold reason between 10 and 2,000 characters';
  END IF;
  IF requested_expires_at IS NOT NULL AND requested_expires_at <= NOW() THEN
    RAISE EXCEPTION 'A legal-hold expiration must be in the future';
  END IF;
  IF requested_scope_type = 'global'
    AND (requested_district_id IS NOT NULL OR requested_school_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'A global legal hold cannot include a district or school';
  END IF;
  IF requested_scope_type = 'district'
    AND (requested_district_id IS NULL OR requested_school_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'A district legal hold requires exactly one district';
  END IF;
  IF requested_scope_type = 'school' AND requested_school_id IS NULL THEN
    RAISE EXCEPTION 'A school legal hold requires a school';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  -- A crashed retention worker must not block a hold forever. The same
  -- expiration runs when retention starts, so either transition can recover
  -- the stale lease while holding the shared gate.
  UPDATE public.data_retention_runs
  SET status = 'failed',
      completed_at = NOW(),
      error_message = COALESCE(error_message, 'Retention worker lease expired.')
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '2 hours';

  -- Prepared account deletion is a lease around external cleanup. A crashed
  -- application must fail closed for a conservative window, but cannot prevent
  -- emergency preservation forever. Retrying preparation renews prepared_at.
  UPDATE public.account_deletion_executions
  SET status = 'failed',
      last_error = COALESCE(
        last_error,
        'Account deletion preparation lease expired before finalization.'
      ),
      updated_at = NOW()
  WHERE status IN ('prepared', 'auth_delete_failed')
    AND COALESCE(updated_at, prepared_at) < NOW() - INTERVAL '30 minutes';

  canonical_district_id := requested_district_id;
  IF requested_scope_type = 'district' THEN
    PERFORM 1
    FROM public.districts district
    WHERE district.id = requested_district_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'District not found';
    END IF;
  ELSIF requested_scope_type = 'school' THEN
    SELECT school.district_id
    INTO canonical_district_id
    FROM public.schools school
    WHERE school.id = requested_school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'School not found';
    END IF;
    IF requested_district_id IS NOT NULL
      AND requested_district_id IS DISTINCT FROM canonical_district_id
    THEN
      RAISE EXCEPTION 'The legal-hold district does not match the selected school';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.data_retention_runs run
    WHERE run.status = 'running'
  ) THEN
    RAISE EXCEPTION
      'A data-retention run is active; retry the legal hold after it completes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_executions execution
    WHERE execution.status IN ('prepared', 'auth_delete_failed')
      AND (
        requested_scope_type = 'global'
        OR (
          requested_scope_type = 'district'
          AND execution.district_id = canonical_district_id
        )
        OR (
          requested_scope_type = 'school'
          AND execution.school_id = requested_school_id
        )
      )
  ) THEN
    RAISE EXCEPTION
      'An account deletion is already prepared in this scope; retry the legal hold after it finishes';
  END IF;

  INSERT INTO public.legal_holds (
    scope_type,
    district_id,
    school_id,
    category,
    reason,
    placed_by,
    expires_at
  ) VALUES (
    requested_scope_type,
    canonical_district_id,
    requested_school_id,
    requested_category,
    BTRIM(requested_reason),
    auth.uid(),
    requested_expires_at
  )
  RETURNING id INTO hold_id;

  RETURN hold_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  UPDATE public.legal_holds
  SET released_by = auth.uid(),
      released_at = NOW(),
      release_reason = BTRIM(requested_release_reason)
  WHERE id = target_hold_id
    AND released_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.begin_data_retention_run()
RETURNS UUID AS $$
DECLARE
  new_run_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  UPDATE public.data_retention_runs
  SET status = 'failed',
      completed_at = NOW(),
      error_message = COALESCE(error_message, 'Retention worker lease expired.')
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '2 hours';

  IF EXISTS (
    SELECT 1
    FROM public.data_retention_runs run
    WHERE run.status = 'running'
  ) THEN
    RETURN NULL;
  END IF;

  IF public.has_any_active_legal_hold() THEN
    INSERT INTO public.data_retention_runs (
      status,
      completed_at,
      deleted_counts,
      error_message,
      skipped_reason
    ) VALUES (
      'completed',
      NOW(),
      '{}'::JSONB,
      NULL,
      'Automatic retention paused by an active legal hold.'
    );
    RETURN NULL;
  END IF;

  INSERT INTO public.data_retention_runs (status)
  VALUES ('running')
  RETURNING id INTO new_run_id;

  RETURN new_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.prepare_user_account_deletion(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  target_profile public.profiles%ROWTYPE;
  target_district_id UUID;
  execution_id UUID;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );
  -- This is the same per-user lock used by create_coursework_upload_intent.
  -- Intent creation either commits before the freeze and is rejected below,
  -- or waits until the now-deactivated account can no longer create one.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('coursework-upload-intents:' || target_user_id::TEXT, 0)
  );

  SELECT *
  INTO target_profile
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

  -- Locking each pending row also serializes against registration. A
  -- registration that already owns a row lock completes first and is visible
  -- to the external cleanup read; every remaining pending row is terminal
  -- before the prepared execution commits.
  UPDATE public.coursework_upload_intents
  SET status = 'rejected',
      rejection_reason = 'Account deletion prepared before upload registration'
  WHERE user_id = target_user_id
    AND status = 'pending';

  UPDATE public.profiles
  SET account_status = 'deactivated',
      updated_at = NOW()
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
    target_user_id,
    school_id,
    district_id,
    status,
    prepared_at,
    auth_deleted_at,
    last_error,
    updated_at
  ) VALUES (
    target_user_id,
    target_profile.school_id,
    target_district_id,
    'prepared',
    NOW(),
    NULL,
    NULL,
    NOW()
  )
  ON CONFLICT ON CONSTRAINT account_deletion_executions_target_user_id_key
  DO UPDATE
    SET school_id = EXCLUDED.school_id,
        district_id = EXCLUDED.district_id,
        status = 'prepared',
        prepared_at = NOW(),
        auth_deleted_at = NULL,
        last_error = NULL,
        updated_at = NOW()
  RETURNING id INTO execution_id;

  RETURN execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.finalize_user_account_deletion(
  target_execution_id UUID,
  requested_status TEXT,
  requested_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status TEXT;
BEGIN
  IF requested_status NOT IN ('failed', 'completed') THEN
    RAISE EXCEPTION 'Account deletion outcome must be failed or completed';
  END IF;
  IF requested_status = 'failed'
    AND char_length(BTRIM(COALESCE(requested_error, ''))) = 0
  THEN
    RAISE EXCEPTION 'A failed account deletion requires an error';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );

  SELECT execution.status
  INTO current_status
  FROM public.account_deletion_executions execution
  WHERE execution.id = target_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF current_status = requested_status THEN
    RETURN TRUE;
  END IF;
  IF current_status = 'auth_delete_failed' AND requested_status = 'failed' THEN
    UPDATE public.account_deletion_executions
    SET status = 'failed',
        last_error = COALESCE(
          NULLIF(LEFT(BTRIM(requested_error), 500), ''),
          last_error
        ),
        updated_at = NOW()
    WHERE id = target_execution_id;
    RETURN TRUE;
  END IF;
  IF current_status <> 'prepared' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.account_deletion_executions
  SET status = requested_status,
      auth_deleted_at = CASE
        WHEN requested_status = 'completed' THEN NOW()
        ELSE NULL
      END,
      last_error = CASE
        WHEN requested_status = 'failed'
          THEN LEFT(BTRIM(requested_error), 500)
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = target_execution_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Notification creation can read an active profile before deletion preparation
-- and enqueue afterward. The row lock makes enqueue-before-prepare visible to
-- the scrub, while enqueue-after-deactivation is rejected before sensitive
-- recipient content can be stranded with a nullable user reference.
CREATE OR REPLACE FUNCTION public.enforce_active_email_outbox_recipient()
RETURNS TRIGGER AS $$
DECLARE
  recipient_status TEXT;
BEGIN
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT profile.account_status
  INTO recipient_status
  FROM public.profiles profile
  WHERE profile.id = NEW.recipient_user_id
  FOR SHARE;

  IF recipient_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Email cannot be queued for an inactive account';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS email_outbox_enforce_active_recipient
  ON public.email_outbox;
CREATE TRIGGER email_outbox_enforce_active_recipient
  BEFORE INSERT OR UPDATE OF recipient_user_id ON public.email_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_email_outbox_recipient();

-- Registration inserts through the existing aggregate-limit triggers. Keep
-- their lock namespace explicit across assignment/submission targets so two
-- registrations cannot both pass an application pre-check and exceed the
-- authoritative row or byte cap.
CREATE OR REPLACE FUNCTION public.enforce_coursework_attachment_limits()
RETURNS TRIGGER AS $$
DECLARE
  attachment_count INTEGER;
  total_bytes BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'club_assignment_attachments' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'coursework-attachment-capacity:'
          || NEW.assignment_id::TEXT
          || ':assignment',
        0
      )
    );
    SELECT COUNT(*), COALESCE(SUM(file_size), 0)
    INTO attachment_count, total_bytes
    FROM public.club_assignment_attachments
    WHERE assignment_id = NEW.assignment_id
      AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

    IF attachment_count >= 20 THEN
      RAISE EXCEPTION 'An assignment may have at most 20 attached materials';
    END IF;
    IF total_bytes + COALESCE(NEW.file_size, 0) > 200 * 1024 * 1024 THEN
      RAISE EXCEPTION 'Assignment materials may use at most 200 MB';
    END IF;
  ELSIF TG_TABLE_NAME = 'club_submission_attachments' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'coursework-attachment-capacity:'
          || NEW.assignment_id::TEXT
          || ':submission:'
          || NEW.student_id::TEXT,
        0
      )
    );
    SELECT COUNT(*), COALESCE(SUM(file_size), 0)
    INTO attachment_count, total_bytes
    FROM public.club_submission_attachments
    WHERE assignment_id = NEW.assignment_id
      AND student_id = NEW.student_id
      AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

    IF attachment_count >= 10 THEN
      RAISE EXCEPTION 'A submission may have at most 10 attachments';
    END IF;
    IF total_bytes + COALESCE(NEW.file_size, 0) > 100 * 1024 * 1024 THEN
      RAISE EXCEPTION 'Submission attachments may use at most 100 MB';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Storage deletion happens first in the application. This atomic database
-- phase keeps a registered upload intent as a terminal cleanup record before
-- removing its attachment, so replay of the still-live signed token cannot
-- recreate the attachment and retention can re-remove the object path.
CREATE OR REPLACE FUNCTION public.finalize_coursework_attachment_removal(
  target_attachment_id UUID,
  target_assignment_id UUID,
  target_attachment_kind TEXT,
  expected_storage_path TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  actual_storage_path TEXT;
BEGIN
  IF target_attachment_kind = 'assignment' THEN
    SELECT attachment.storage_path
    INTO actual_storage_path
    FROM public.club_assignment_attachments attachment
    WHERE attachment.id = target_attachment_id
      AND attachment.assignment_id = target_assignment_id
    FOR UPDATE;
  ELSIF target_attachment_kind = 'submission' THEN
    SELECT attachment.storage_path
    INTO actual_storage_path
    FROM public.club_submission_attachments attachment
    WHERE attachment.id = target_attachment_id
      AND attachment.assignment_id = target_assignment_id
    FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported coursework attachment target';
  END IF;

  IF NOT FOUND THEN
    -- Idempotent retry after a lost response.
    RETURN TRUE;
  END IF;
  IF actual_storage_path IS DISTINCT FROM expected_storage_path THEN
    RAISE EXCEPTION 'Coursework attachment storage path changed';
  END IF;

  UPDATE public.coursework_upload_intents intent
  SET status = 'rejected',
      attachment_id = NULL,
      registered_at = NULL,
      rejection_reason = 'Attachment removed after upload registration'
  WHERE intent.attachment_id = target_attachment_id
    AND intent.status = 'registered';

  IF target_attachment_kind = 'assignment' THEN
    DELETE FROM public.club_assignment_attachments attachment
    WHERE attachment.id = target_attachment_id
      AND attachment.assignment_id = target_assignment_id;
  ELSE
    DELETE FROM public.club_submission_attachments attachment
    WHERE attachment.id = target_attachment_id
      AND attachment.assignment_id = target_assignment_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Keep the retention worker's explicit allowlist complete, and never let
-- history cleanup erase an in-flight account-deletion barrier.
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
  PERFORM pg_advisory_xact_lock(
    hashtextextended('stormhub:legal-hold-execution-barrier', 0)
  );
  IF public.has_any_active_legal_hold() THEN
    RAISE EXCEPTION 'An active legal hold blocks retention deletion';
  END IF;

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
    WHEN 'platform_support_access_log' THEN 'occurred_at'
    WHEN 'account_deletion_executions' THEN 'updated_at'
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
  ELSIF target_table = 'account_deletion_executions' THEN
    extra_predicate :=
      ' AND status IN (''failed'', ''auth_delete_failed'', ''completed'')';
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.place_legal_hold(
  TEXT, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_legal_hold(UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_data_retention_run()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_user_account_deletion(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_user_account_deletion(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_coursework_attachment_removal(
  UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_retention_batch(
  TEXT, TIMESTAMPTZ, UUID, INTEGER
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_legal_hold(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_active_email_outbox_recipient()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_tenant_offboarding_district_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_offboarding_district_tree_freeze()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.place_legal_hold(
  TEXT, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_legal_hold(UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_data_retention_run()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_user_account_deletion(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_user_account_deletion(UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_coursework_attachment_removal(
  UUID, UUID, TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_retention_batch(
  TEXT, TIMESTAMPTZ, UUID, INTEGER
) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_legal_hold(UUID, UUID)
  TO service_role;

COMMENT ON FUNCTION public.finalize_user_account_deletion(UUID, TEXT, TEXT) IS
  'Service-only, idempotent transition that releases a prepared account-deletion barrier after external work fails or completes.';
COMMENT ON FUNCTION public.finalize_coursework_attachment_removal(
  UUID, UUID, TEXT, TEXT
) IS
  'Service-only atomic attachment removal finalizer that terminalizes a matching registered upload intent for signed-token replay cleanup.';

COMMIT;
