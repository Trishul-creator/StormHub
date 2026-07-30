-- Final operational safeguards for idempotent support replies and private
-- coursework attachment registration.

BEGIN;

ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_dedupe_key_length;
ALTER TABLE public.email_outbox
  ADD CONSTRAINT email_outbox_dedupe_key_length
  CHECK (dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_dedupe_key_unique
  ON public.email_outbox(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Older clients could register the same storage object more than once after a
-- retry. Retain the earliest reference and remove only redundant database
-- rows; the underlying private object remains referenced by the retained row.
WITH duplicate_assignment_paths AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY storage_path
        ORDER BY created_at, id
      ) AS duplicate_number
    FROM public.club_assignment_attachments
    WHERE storage_path IS NOT NULL
  ) ranked
  WHERE duplicate_number > 1
)
DELETE FROM public.club_assignment_attachments attachment
USING duplicate_assignment_paths duplicate
WHERE attachment.id = duplicate.id;

WITH duplicate_submission_paths AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY storage_path
        ORDER BY (submission_id IS NOT NULL) DESC, created_at, id
      ) AS duplicate_number
    FROM public.club_submission_attachments
    WHERE storage_path IS NOT NULL
  ) ranked
  WHERE duplicate_number > 1
)
DELETE FROM public.club_submission_attachments attachment
USING duplicate_submission_paths duplicate
WHERE attachment.id = duplicate.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_attachments_storage_path_unique
  ON public.club_assignment_attachments(storage_path)
  WHERE storage_path IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submission_attachments_storage_path_unique
  ON public.club_submission_attachments(storage_path)
  WHERE storage_path IS NOT NULL;

COMMENT ON COLUMN public.email_outbox.dedupe_key IS
  'Stable application key preventing duplicate queued messages after retries.';
COMMENT ON INDEX public.idx_assignment_attachments_storage_path_unique IS
  'A private assignment object can be registered only once.';
COMMENT ON INDEX public.idx_submission_attachments_storage_path_unique IS
  'A private submission object can be registered only once.';

COMMIT;
