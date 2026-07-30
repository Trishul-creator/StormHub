BEGIN;

-- Email delivery is lease-based so an immediate send and a scheduled recovery
-- worker cannot deliver the same outbox row concurrently.
ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_attempt_count_check;
ALTER TABLE public.email_outbox
  ADD CONSTRAINT email_outbox_attempt_count_check
  CHECK (attempt_count >= 0 AND attempt_count <= 100);

CREATE INDEX IF NOT EXISTS idx_email_outbox_delivery_queue
  ON public.email_outbox(next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed') AND retryable = TRUE;

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

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id
    FROM public.email_outbox AS queue
    WHERE queue.status IN ('pending', 'failed')
      AND queue.retryable = TRUE
      AND queue.attempt_count < 5
      AND (target_id IS NULL OR queue.id = target_id)
      AND (queue.next_attempt_at IS NULL OR queue.next_attempt_at <= NOW())
      AND (
        queue.claimed_at IS NULL
        OR queue.claimed_at < NOW() - INTERVAL '10 minutes'
      )
    ORDER BY queue.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(target_limit, 1), 100)
  )
  UPDATE public.email_outbox AS queue
  SET claimed_at = NOW(),
      claim_token = target_worker_token,
      last_attempt_at = NOW(),
      attempt_count = queue.attempt_count + 1
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING
    queue.id,
    queue.recipient_email,
    queue.subject,
    queue.body,
    queue.attempt_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_email_outbox(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(UUID, INTEGER, UUID) TO service_role;

-- Start a single observable retention run. A crashed run is marked failed after
-- two hours so a future daily invocation can safely recover.
CREATE OR REPLACE FUNCTION public.begin_data_retention_run()
RETURNS UUID AS $$
DECLARE
  new_run_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('stormhub_data_retention'));

  UPDATE public.data_retention_runs
  SET status = 'failed',
      completed_at = NOW(),
      error_message = COALESCE(error_message, 'Retention worker lease expired.')
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '2 hours';

  IF EXISTS (
    SELECT 1
    FROM public.data_retention_runs
    WHERE status = 'running'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.data_retention_runs (status)
  VALUES ('running')
  RETURNING id INTO new_run_id;

  RETURN new_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.begin_data_retention_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_data_retention_run() TO service_role;

COMMIT;
