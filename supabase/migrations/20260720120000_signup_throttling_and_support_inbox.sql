-- Add durable signup throttling and complete support inbox policies.

CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT,
  email_hash TEXT NOT NULL,
  was_successful BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_email_created
  ON public.signup_attempts(email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_created
  ON public.signup_attempts(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signup_attempts FROM anon, authenticated;

DROP POLICY IF EXISTS "feedback_insert" ON public.feedback;
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "feedback_admin_update" ON public.feedback;
CREATE POLICY "feedback_admin_update" ON public.feedback FOR UPDATE
  USING (public.can_admin_school(school_id))
  WITH CHECK (public.can_admin_school(school_id));

DROP POLICY IF EXISTS "email_outbox_admin_read" ON public.email_outbox;
CREATE POLICY "email_outbox_admin_read" ON public.email_outbox FOR SELECT
  USING (public.is_super_admin());
