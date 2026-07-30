-- Bind every direct coursework upload to a short-lived, rate-limited database
-- intent. Registration is atomic so a client cannot substitute another
-- assignment, user, target, path, name, content type, or size after receiving a
-- signed Storage upload token.

BEGIN;

CREATE TABLE public.coursework_upload_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Keep the object path available to retention cleanup after an account is
  -- deleted. Issuance and registration still require a concrete active actor.
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_id UUID NOT NULL REFERENCES public.club_assignments(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('assignment', 'submission')),
  storage_path TEXT NOT NULL UNIQUE
    CHECK (
      char_length(storage_path) BETWEEN 20 AND 1000
      AND storage_path NOT LIKE '/%'
      AND storage_path NOT LIKE '%..%'
    ),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  mime_type TEXT NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 255),
  expected_size BIGINT NOT NULL CHECK (expected_size BETWEEN 1 AND 20971520),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'registered', 'rejected', 'expired')),
  attachment_id UUID,
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR char_length(rejection_reason) <= 255
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  registered_at TIMESTAMPTZ,
  object_removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      status = 'registered'
      AND attachment_id IS NOT NULL
      AND registered_at IS NOT NULL
      AND object_removed_at IS NULL
    )
    OR (
      status <> 'registered'
      AND attachment_id IS NULL
      AND registered_at IS NULL
      AND (
        object_removed_at IS NULL
        OR (
          status IN ('rejected', 'expired')
          -- Signed upload tokens can outlive the ten-minute registration
          -- window. Retention must keep re-checking the recorded path until a
          -- conservative post-expiry grace period has elapsed.
          AND object_removed_at >= expires_at + INTERVAL '3 hours'
        )
      )
    )
  )
);

CREATE INDEX idx_coursework_upload_intents_user_pending
  ON public.coursework_upload_intents(user_id, expires_at)
  WHERE status = 'pending';
CREATE INDEX idx_coursework_upload_intents_cleanup
  ON public.coursework_upload_intents(status, expires_at, created_at);
CREATE INDEX idx_coursework_upload_intents_registered_cleanup
  ON public.coursework_upload_intents(registered_at)
  WHERE status = 'registered';

CREATE TRIGGER coursework_upload_intents_updated_at
  BEFORE UPDATE ON public.coursework_upload_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.coursework_upload_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coursework_upload_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.coursework_upload_intents TO service_role;

CREATE OR REPLACE FUNCTION public.coursework_upload_actor_is_authorized(
  actor_user_uuid UUID,
  assignment_uuid UUID,
  upload_target TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    JOIN public.club_assignments assignment ON assignment.id = assignment_uuid
    JOIN public.clubs club ON club.id = assignment.club_id
    JOIN public.schools school ON school.id = club.school_id
    LEFT JOIN public.districts district ON district.id = school.district_id
    WHERE profile.id = actor_user_uuid
      AND profile.account_status = 'active'
      AND club.is_active = TRUE
      AND school.is_active = TRUE
      AND school.access_disabled_at IS NULL
      AND (district.id IS NULL OR district.is_active = TRUE)
      AND (district.id IS NULL OR district.access_disabled_at IS NULL)
      AND (
        (
          upload_target = 'submission'
          AND assignment.status = 'published'
          AND profile.role = 'student'
          AND profile.school_id = school.id
          AND EXISTS (
            SELECT 1
            FROM public.club_memberships membership
            WHERE membership.club_id = club.id
              AND membership.user_id = actor_user_uuid
              AND membership.status = 'active'
          )
        )
        OR (
          upload_target = 'assignment'
          AND (
            (
              profile.role = 'admin'
              AND profile.school_id = school.id
            )
            OR (
              profile.role = 'district_admin'
              AND profile.district_id = school.district_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.club_memberships membership
              WHERE membership.club_id = club.id
                AND membership.user_id = actor_user_uuid
                AND membership.status = 'active'
                AND profile.school_id = school.id
                AND (
                  (profile.role = 'teacher' AND membership.role = 'sponsor')
                  OR (
                    profile.role = 'student'
                    AND membership.role IN ('president', 'officer')
                  )
                )
            )
          )
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.create_coursework_upload_intent(
  actor_user_uuid UUID,
  assignment_uuid UUID,
  upload_target TEXT,
  object_path TEXT,
  expected_file_name TEXT,
  expected_mime_type TEXT,
  expected_file_size BIGINT
)
RETURNS UUID AS $$
DECLARE
  intent_uuid UUID;
  target_club_id UUID;
  target_school_id UUID;
  target_district_id UUID;
  assignment_state TEXT;
  actor_profile public.profiles%ROWTYPE;
  active_intent_count INTEGER;
  active_intent_bytes BIGINT;
  recent_intent_count INTEGER;
  recent_intent_bytes BIGINT;
  reserved_bytes_per_intent CONSTANT BIGINT := 20 * 1024 * 1024;
  expected_prefix TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('coursework-upload-intents:' || actor_user_uuid::TEXT, 0)
  );

  SELECT profile.*
  INTO actor_profile
  FROM public.profiles profile
  WHERE profile.id = actor_user_uuid
    AND profile.account_status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active account is required';
  END IF;

  SELECT assignment.club_id, club.school_id, school.district_id, assignment.status
  INTO target_club_id, target_school_id, target_district_id, assignment_state
  FROM public.club_assignments assignment
  JOIN public.clubs club ON club.id = assignment.club_id
  JOIN public.schools school ON school.id = club.school_id
  LEFT JOIN public.districts district ON district.id = school.district_id
  WHERE assignment.id = assignment_uuid
    AND club.is_active = TRUE
    AND school.is_active = TRUE
    AND school.access_disabled_at IS NULL
    AND (district.id IS NULL OR district.is_active = TRUE)
    AND (district.id IS NULL OR district.access_disabled_at IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found in an active school';
  END IF;

  IF upload_target = 'submission' THEN
    IF actor_profile.role <> 'student'
      OR actor_profile.school_id IS DISTINCT FROM target_school_id
      OR assignment_state <> 'published'
      OR NOT EXISTS (
        SELECT 1
        FROM public.club_memberships membership
        WHERE membership.club_id = target_club_id
          AND membership.user_id = actor_user_uuid
          AND membership.status = 'active'
      )
    THEN
      RAISE EXCEPTION 'An active student club membership is required';
    END IF;
  ELSIF upload_target = 'assignment' THEN
    IF NOT (
      (
        actor_profile.role = 'admin'
        AND actor_profile.school_id = target_school_id
      )
      OR (
        actor_profile.role = 'district_admin'
        AND actor_profile.district_id = target_district_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.club_memberships membership
        WHERE membership.club_id = target_club_id
          AND membership.user_id = actor_user_uuid
          AND membership.status = 'active'
          AND (
            (
              actor_profile.role = 'teacher'
              AND membership.role = 'sponsor'
            )
            OR (
              actor_profile.role = 'student'
              AND membership.role IN ('president', 'officer')
            )
          )
          AND actor_profile.school_id = target_school_id
      )
    ) THEN
      RAISE EXCEPTION 'Coursework management access is required';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid coursework upload target';
  END IF;

  IF expected_file_size < 1 OR expected_file_size > 20971520 THEN
    RAISE EXCEPTION 'Files must be 20 MB or smaller';
  END IF;
  IF char_length(expected_file_name) NOT BETWEEN 1 AND 180
    OR char_length(expected_mime_type) NOT BETWEEN 1 AND 255
  THEN
    RAISE EXCEPTION 'Invalid coursework upload metadata';
  END IF;

  expected_prefix := assignment_uuid::TEXT
    || CASE WHEN upload_target = 'assignment' THEN '/materials/' ELSE '/submissions/' END
    || actor_user_uuid::TEXT || '/';
  IF object_path NOT LIKE expected_prefix || '%'
    OR object_path LIKE '%..%'
    OR char_length(object_path) > 1000
  THEN
    RAISE EXCEPTION 'Invalid coursework storage path';
  END IF;

  UPDATE public.coursework_upload_intents
  SET status = 'expired',
      rejection_reason = COALESCE(rejection_reason, 'Registration window expired')
  WHERE user_id = actor_user_uuid
    AND status = 'pending'
    AND expires_at <= NOW();

  -- A signed Storage token can upload any object up to the bucket's per-file
  -- limit, regardless of the browser-declared expected size. Reserve the full
  -- 20 MB for every token so a dishonest one-byte declaration cannot bypass
  -- either the pending or rolling byte quota.
  SELECT
    COUNT(*),
    COUNT(*)::BIGINT * reserved_bytes_per_intent
  INTO active_intent_count, active_intent_bytes
  FROM public.coursework_upload_intents
  WHERE user_id = actor_user_uuid
    AND status = 'pending'
    AND expires_at > NOW();

  IF active_intent_count >= 10 THEN
    RAISE EXCEPTION 'Finish or wait for an existing private upload before preparing more files';
  END IF;
  IF active_intent_bytes + reserved_bytes_per_intent > 100 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Pending private uploads may use at most 100 MB';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*)::BIGINT * reserved_bytes_per_intent
  INTO recent_intent_count, recent_intent_bytes
  FROM public.coursework_upload_intents
  WHERE user_id = actor_user_uuid
    AND created_at > NOW() - INTERVAL '10 minutes';

  IF recent_intent_count >= 30 THEN
    RAISE EXCEPTION 'Too many private uploads were prepared. Wait a few minutes and try again';
  END IF;
  IF recent_intent_bytes + reserved_bytes_per_intent > 250 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Private upload preparation limit reached. Wait a few minutes and try again';
  END IF;

  INSERT INTO public.coursework_upload_intents (
    user_id,
    assignment_id,
    target,
    storage_path,
    file_name,
    mime_type,
    expected_size,
    expires_at
  )
  VALUES (
    actor_user_uuid,
    assignment_uuid,
    upload_target,
    object_path,
    expected_file_name,
    lower(expected_mime_type),
    expected_file_size,
    NOW() + INTERVAL '10 minutes'
  )
  RETURNING id INTO intent_uuid;

  RETURN intent_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.register_coursework_upload_intent(
  intent_uuid UUID,
  actor_user_uuid UUID,
  assignment_uuid UUID,
  upload_target TEXT,
  object_path TEXT,
  actual_file_name TEXT,
  actual_mime_type TEXT,
  actual_file_size BIGINT
)
RETURNS UUID AS $$
DECLARE
  target_intent public.coursework_upload_intents%ROWTYPE;
  new_attachment_id UUID;
  attachment_still_exists BOOLEAN;
BEGIN
  SELECT *
  INTO target_intent
  FROM public.coursework_upload_intents
  WHERE id = intent_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Private upload intent not found';
  END IF;
  IF target_intent.user_id <> actor_user_uuid
    OR target_intent.assignment_id <> assignment_uuid
    OR target_intent.target <> upload_target
    OR target_intent.storage_path <> object_path
    OR target_intent.file_name <> actual_file_name
    OR target_intent.mime_type <> lower(actual_mime_type)
    OR target_intent.expected_size <> actual_file_size
  THEN
    RAISE EXCEPTION 'Private upload metadata does not match the prepared intent';
  END IF;

  IF target_intent.status = 'registered' THEN
    IF target_intent.target = 'assignment' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.club_assignment_attachments attachment
        WHERE attachment.id = target_intent.attachment_id
          AND attachment.assignment_id = target_intent.assignment_id
          AND attachment.uploaded_by = target_intent.user_id
          AND attachment.storage_path = target_intent.storage_path
      )
      INTO attachment_still_exists;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.club_submission_attachments attachment
        WHERE attachment.id = target_intent.attachment_id
          AND attachment.assignment_id = target_intent.assignment_id
          AND attachment.student_id = target_intent.user_id
          AND attachment.storage_path = target_intent.storage_path
      )
      INTO attachment_still_exists;
    END IF;

    IF NOT attachment_still_exists THEN
      RAISE EXCEPTION 'Registered coursework attachment no longer exists';
    END IF;
    RETURN target_intent.attachment_id;
  END IF;
  IF target_intent.status <> 'pending' THEN
    RAISE EXCEPTION 'This private upload can no longer be registered';
  END IF;
  IF target_intent.expires_at <= NOW() THEN
    RAISE EXCEPTION 'This private upload expired. Upload the file again';
  END IF;
  IF NOT public.coursework_upload_actor_is_authorized(
    actor_user_uuid,
    assignment_uuid,
    upload_target
  ) THEN
    RAISE EXCEPTION 'Coursework upload access is no longer active';
  END IF;

  IF upload_target = 'assignment' THEN
    INSERT INTO public.club_assignment_attachments (
      assignment_id,
      uploaded_by,
      source_type,
      copy_mode,
      file_name,
      mime_type,
      file_size,
      storage_path
    )
    VALUES (
      assignment_uuid,
      actor_user_uuid,
      'upload',
      'reference',
      actual_file_name,
      lower(actual_mime_type),
      actual_file_size,
      object_path
    )
    RETURNING id INTO new_attachment_id;
  ELSE
    INSERT INTO public.club_submission_attachments (
      assignment_id,
      submission_id,
      student_id,
      source_type,
      file_name,
      mime_type,
      file_size,
      storage_path
    )
    VALUES (
      assignment_uuid,
      NULL,
      actor_user_uuid,
      'upload',
      actual_file_name,
      lower(actual_mime_type),
      actual_file_size,
      object_path
    )
    RETURNING id INTO new_attachment_id;
  END IF;

  UPDATE public.coursework_upload_intents
  SET status = 'registered',
      attachment_id = new_attachment_id,
      registered_at = NOW(),
      rejection_reason = NULL
  WHERE id = target_intent.id;

  RETURN new_attachment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.reject_coursework_upload_intent(
  intent_uuid UUID,
  actor_user_uuid UUID,
  rejection_text TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.coursework_upload_intents
  SET status = 'rejected',
      rejection_reason = LEFT(
        COALESCE(NULLIF(BTRIM(rejection_text), ''), 'Upload rejected by server validation'),
        255
      )
  WHERE id = intent_uuid
    AND user_id = actor_user_uuid
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_coursework_upload_intent(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coursework_upload_actor_is_authorized(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_coursework_upload_intent(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_coursework_upload_intent(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_coursework_upload_intent(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_coursework_upload_intent(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_coursework_upload_intent(
  UUID, UUID, TEXT
) TO service_role;

COMMENT ON TABLE public.coursework_upload_intents IS
  'Short-lived, server-only authorization records binding private coursework uploads to an exact actor, assignment, target, path, name, MIME type, and size.';
COMMENT ON COLUMN public.coursework_upload_intents.object_removed_at IS
  'Set by retention only after an expired or rejected intent object is removed; terminal rows remain available through the signed-token grace window for repeat cleanup.';
COMMENT ON FUNCTION public.create_coursework_upload_intent(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) IS
  'Atomically applies active-intent and rolling preparation quotas before authorizing one direct private upload.';
COMMENT ON FUNCTION public.register_coursework_upload_intent(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT
) IS
  'Atomically consumes an exact, unexpired upload intent and creates its coursework attachment record.';

COMMIT;
