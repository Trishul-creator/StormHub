BEGIN;

ALTER TABLE public.club_assignments
  ADD COLUMN IF NOT EXISTS submission_mode TEXT NOT NULL DEFAULT 'submission'
    CHECK (submission_mode IN ('submission', 'completion'));

CREATE TABLE IF NOT EXISTS public.club_assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.club_assignments(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'google_drive')),
  copy_mode TEXT NOT NULL DEFAULT 'reference'
    CHECK (copy_mode IN ('reference', 'student_copy')),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 500),
  mime_type TEXT CHECK (mime_type IS NULL OR char_length(mime_type) <= 255),
  file_size BIGINT CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 20971520)),
  storage_path TEXT,
  external_url TEXT,
  google_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      source_type = 'upload'
      AND storage_path IS NOT NULL
      AND external_url IS NULL
      AND google_file_id IS NULL
      AND copy_mode = 'reference'
    )
    OR (
      source_type = 'google_drive'
      AND storage_path IS NULL
      AND external_url IS NOT NULL
      AND google_file_id IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.club_submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.club_assignments(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.club_assignment_submissions(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'google_drive')),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 500),
  mime_type TEXT CHECK (mime_type IS NULL OR char_length(mime_type) <= 255),
  file_size BIGINT CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 20971520)),
  storage_path TEXT,
  external_url TEXT,
  google_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      source_type = 'upload'
      AND storage_path IS NOT NULL
      AND external_url IS NULL
      AND google_file_id IS NULL
    )
    OR (
      source_type = 'google_drive'
      AND storage_path IS NULL
      AND external_url IS NOT NULL
      AND google_file_id IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.club_assignment_student_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.club_assignments(id) ON DELETE CASCADE,
  assignment_attachment_id UUID NOT NULL
    REFERENCES public.club_assignment_attachments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 500),
  web_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_attachment_id, student_id)
);

-- OAuth credentials are encrypted by the application before storage. This table
-- intentionally has no authenticated-user RLS policies and is service-role only.
CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_email TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  granted_scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment
  ON public.club_assignment_attachments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_assignment_student
  ON public.club_submission_attachments(assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission
  ON public.club_submission_attachments(submission_id);
CREATE INDEX IF NOT EXISTS idx_student_copies_assignment_student
  ON public.club_assignment_student_copies(assignment_id, student_id);

DROP TRIGGER IF EXISTS club_assignment_student_copies_updated_at
  ON public.club_assignment_student_copies;
CREATE TRIGGER club_assignment_student_copies_updated_at
  BEFORE UPDATE ON public.club_assignment_student_copies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS google_drive_connections_updated_at
  ON public.google_drive_connections;
CREATE TRIGGER google_drive_connections_updated_at
  BEFORE UPDATE ON public.google_drive_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Files are private. The application authorizes each operation before issuing a
-- short-lived signed upload or download URL with the service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('coursework-private', 'coursework-private', FALSE, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit;

CREATE OR REPLACE FUNCTION public.submit_club_assignment(
  assignment_uuid UUID,
  submitted_text TEXT DEFAULT NULL,
  submitted_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  target_assignment public.club_assignments%ROWTYPE;
  actor_role TEXT;
  normalized_text TEXT := NULLIF(BTRIM(submitted_text), '');
  normalized_url TEXT := NULLIF(BTRIM(submitted_url), '');
  submission_uuid UUID;
  attachment_count INTEGER;
BEGIN
  SELECT * INTO target_assignment
  FROM public.club_assignments
  WHERE id = assignment_uuid;

  IF NOT FOUND OR target_assignment.status <> 'published' THEN
    RAISE EXCEPTION 'This assignment is not accepting submissions';
  END IF;

  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';

  IF actor_role <> 'student' OR NOT public.is_club_member(target_assignment.club_id) THEN
    RAISE EXCEPTION 'An active student club membership is required';
  END IF;

  SELECT count(*) INTO attachment_count
  FROM public.club_submission_attachments
  WHERE assignment_id = target_assignment.id
    AND student_id = auth.uid();

  IF target_assignment.submission_mode = 'submission'
    AND normalized_text IS NULL
    AND normalized_url IS NULL
    AND attachment_count = 0 THEN
    RAISE EXCEPTION 'Add a response, link, or file';
  END IF;

  IF normalized_text IS NOT NULL AND char_length(normalized_text) > 20000 THEN
    RAISE EXCEPTION 'Submission text is too long';
  END IF;

  IF normalized_url IS NOT NULL AND normalized_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Submission link must use http or https';
  END IF;

  INSERT INTO public.club_assignment_submissions (
    assignment_id,
    student_id,
    submission_text,
    attachment_url,
    status,
    submitted_at
  ) VALUES (
    target_assignment.id,
    auth.uid(),
    normalized_text,
    normalized_url,
    'submitted',
    NOW()
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    submission_text = EXCLUDED.submission_text,
    attachment_url = EXCLUDED.attachment_url,
    status = 'submitted',
    submitted_at = NOW(),
    grade_points = NULL,
    feedback = NULL,
    graded_by = NULL,
    graded_at = NULL
  RETURNING id INTO submission_uuid;

  UPDATE public.club_submission_attachments
  SET submission_id = submission_uuid
  WHERE assignment_id = target_assignment.id
    AND student_id = auth.uid();

  RETURN submission_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.club_assignment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_assignment_student_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignment_attachments_read"
  ON public.club_assignment_attachments;
CREATE POLICY "assignment_attachments_read"
  ON public.club_assignment_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_assignments a
      WHERE a.id = assignment_id
        AND (
          public.can_manage_club_coursework(a.club_id)
          OR (
            a.status IN ('published', 'closed')
            AND public.is_club_member(a.club_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "active_authenticated_account"
  ON public.club_assignment_attachments;
CREATE POLICY "active_authenticated_account"
  ON public.club_assignment_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "submission_attachments_read"
  ON public.club_submission_attachments;
CREATE POLICY "submission_attachments_read"
  ON public.club_submission_attachments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_assignments a
      WHERE a.id = assignment_id
        AND public.can_manage_club_coursework(a.club_id)
    )
  );

DROP POLICY IF EXISTS "active_authenticated_account"
  ON public.club_submission_attachments;
CREATE POLICY "active_authenticated_account"
  ON public.club_submission_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "student_copies_read"
  ON public.club_assignment_student_copies;
CREATE POLICY "student_copies_read"
  ON public.club_assignment_student_copies FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_assignments a
      WHERE a.id = assignment_id
        AND public.can_manage_club_coursework(a.club_id)
    )
  );

DROP POLICY IF EXISTS "active_authenticated_account"
  ON public.club_assignment_student_copies;
CREATE POLICY "active_authenticated_account"
  ON public.club_assignment_student_copies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

GRANT SELECT ON TABLE
  public.club_assignment_attachments,
  public.club_submission_attachments,
  public.club_assignment_student_copies
TO authenticated;

REVOKE ALL ON TABLE public.google_drive_connections FROM anon, authenticated;

GRANT ALL ON TABLE
  public.club_assignment_attachments,
  public.club_submission_attachments,
  public.club_assignment_student_copies,
  public.google_drive_connections
TO service_role;

REVOKE ALL ON FUNCTION public.submit_club_assignment(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_club_assignment(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
