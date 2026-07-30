-- Persist policy acceptance for new accounts and put hard database limits on
-- coursework attachments. The current rollout is limited to high-school users
-- who attest that they are at least 13.

BEGIN;

CREATE TABLE IF NOT EXISTS public.policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  privacy_version TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  acceptable_use_version TEXT NOT NULL,
  age_assurance TEXT NOT NULL CHECK (age_assurance = '13_or_older'),
  source TEXT NOT NULL CHECK (source IN ('password_signup', 'google_onboarding', 'existing_user')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, privacy_version, terms_version, acceptable_use_version)
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user_date
  ON public.policy_acceptances(user_id, accepted_at DESC);

ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_acceptances_read_own" ON public.policy_acceptances;
CREATE POLICY "policy_acceptances_read_own"
  ON public.policy_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.policy_acceptances FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.policy_acceptances TO authenticated;
GRANT ALL ON TABLE public.policy_acceptances TO service_role;

CREATE OR REPLACE FUNCTION public.validate_signup_policy_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  raw_school_id TEXT := NEW.raw_user_meta_data->>'school_id';
  is_google_provider BOOLEAN :=
    lower(COALESCE(NEW.raw_app_meta_data->>'provider', '')) = 'google'
    OR COALESCE(NEW.raw_app_meta_data->'providers', '[]'::JSONB) ? 'google';
BEGIN
  -- A new Google identity has no school until the limited onboarding step.
  -- The server records acceptance when that identity is assigned to a school.
  IF is_google_provider AND COALESCE(raw_school_id, '') = '' THEN
    RETURN NEW;
  END IF;

  -- Invalid or absent school metadata is separately rejected by handle_new_user.
  -- A valid school cannot be used through the public Auth API unless the caller
  -- provides the exact current policy versions and high-school age assurance.
  IF raw_school_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      NEW.raw_user_meta_data->>'stormhub_privacy_version' IS DISTINCT FROM '2026-07-30'
      OR NEW.raw_user_meta_data->>'stormhub_terms_version' IS DISTINCT FROM '2026-07-30'
      OR NEW.raw_user_meta_data->>'stormhub_acceptable_use_version' IS DISTINCT FROM '2026-07-30'
      OR NEW.raw_user_meta_data->>'stormhub_age_assurance' IS DISTINCT FROM '13_or_older'
    )
  THEN
    RAISE EXCEPTION 'Accept the current StormHub policies and confirm age 13 or older';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS validate_signup_policy_acceptance ON auth.users;
CREATE TRIGGER validate_signup_policy_acceptance
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_signup_policy_acceptance();

REVOKE ALL ON FUNCTION public.validate_signup_policy_acceptance()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_signup_policy_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  selected_school_id UUID;
  raw_school_id TEXT := NEW.raw_user_meta_data->>'school_id';
  accepted_privacy_version TEXT := NEW.raw_user_meta_data->>'stormhub_privacy_version';
  accepted_terms_version TEXT := NEW.raw_user_meta_data->>'stormhub_terms_version';
  accepted_acceptable_use_version TEXT := NEW.raw_user_meta_data->>'stormhub_acceptable_use_version';
  accepted_age_assurance TEXT := NEW.raw_user_meta_data->>'stormhub_age_assurance';
BEGIN
  IF accepted_privacy_version IS NULL
    OR accepted_terms_version IS NULL
    OR accepted_acceptable_use_version IS NULL
    OR accepted_age_assurance <> '13_or_older'
  THEN
    RETURN NEW;
  END IF;

  IF raw_school_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    selected_school_id := raw_school_id::UUID;
  END IF;

  INSERT INTO public.policy_acceptances (
    user_id,
    school_id,
    privacy_version,
    terms_version,
    acceptable_use_version,
    age_assurance,
    source
  )
  VALUES (
    NEW.id,
    selected_school_id,
    accepted_privacy_version,
    accepted_terms_version,
    accepted_acceptable_use_version,
    accepted_age_assurance,
    'password_signup'
  )
  ON CONFLICT (user_id, privacy_version, terms_version, acceptable_use_version)
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS capture_signup_policy_acceptance ON auth.users;
CREATE TRIGGER capture_signup_policy_acceptance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.capture_signup_policy_acceptance();

REVOKE ALL ON FUNCTION public.capture_signup_policy_acceptance() FROM PUBLIC, anon, authenticated;

-- Existing upload records may predate required size metadata. Count them
-- conservatively at the per-file maximum so a legacy NULL cannot bypass a
-- total quota, then require a positive size for every future uploaded object.
UPDATE public.club_assignment_attachments
SET file_size = 20 * 1024 * 1024
WHERE source_type = 'upload'
  AND (file_size IS NULL OR file_size <= 0);

UPDATE public.club_submission_attachments
SET file_size = 20 * 1024 * 1024
WHERE source_type = 'upload'
  AND (file_size IS NULL OR file_size <= 0);

ALTER TABLE public.club_assignment_attachments
  DROP CONSTRAINT IF EXISTS assignment_upload_size_required;
ALTER TABLE public.club_assignment_attachments
  ADD CONSTRAINT assignment_upload_size_required
  CHECK (source_type <> 'upload' OR (file_size IS NOT NULL AND file_size > 0));

ALTER TABLE public.club_submission_attachments
  DROP CONSTRAINT IF EXISTS submission_upload_size_required;
ALTER TABLE public.club_submission_attachments
  ADD CONSTRAINT submission_upload_size_required
  CHECK (source_type <> 'upload' OR (file_size IS NOT NULL AND file_size > 0));

CREATE OR REPLACE FUNCTION public.enforce_coursework_attachment_limits()
RETURNS TRIGGER AS $$
DECLARE
  attachment_count INTEGER;
  total_bytes BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'club_assignment_attachments' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('assignment-attachments:' || NEW.assignment_id::TEXT, 0)
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
        'submission-attachments:' || NEW.assignment_id::TEXT || ':' || NEW.student_id::TEXT,
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

DROP TRIGGER IF EXISTS assignment_attachment_limits
  ON public.club_assignment_attachments;
CREATE TRIGGER assignment_attachment_limits
  BEFORE INSERT OR UPDATE OF assignment_id, file_size
  ON public.club_assignment_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coursework_attachment_limits();

DROP TRIGGER IF EXISTS submission_attachment_limits
  ON public.club_submission_attachments;
CREATE TRIGGER submission_attachment_limits
  BEFORE INSERT OR UPDATE OF assignment_id, student_id, file_size
  ON public.club_submission_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coursework_attachment_limits();

REVOKE ALL ON FUNCTION public.enforce_coursework_attachment_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_coursework_attachment_limits() TO service_role;

COMMIT;
