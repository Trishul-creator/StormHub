-- Close the remaining pilot workflow gaps:
-- 1. Allow platform administrators to own an audited tenant-offboarding workflow.
-- 2. Support memorable, administrator-defined school access codes.
-- 3. Store exact opportunity grade eligibility instead of only a broad range.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_school_signup_code()
RETURNS TEXT AS $$
DECLARE
  token TEXT := upper(replace(gen_random_uuid()::TEXT, '-', ''));
  final_digit TEXT := substr('0123456789', 1 + floor(random() * 10)::INT, 1);
BEGIN
  RETURN 'SH-' || substr(token, 1, 4) || '-' || substr(token, 5, 4) || '-'
    || substr(token, 9, 3) || final_digit;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

REVOKE ALL ON FUNCTION public.generate_school_signup_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_school_signup_code() TO service_role;

ALTER TABLE public.school_signup_access
  DROP CONSTRAINT IF EXISTS school_signup_access_access_code_check;

UPDATE public.school_signup_access
SET access_code = public.generate_school_signup_code(),
    rotated_at = NOW()
WHERE access_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
   OR char_length(access_code) NOT BETWEEN 8 AND 32
   OR access_code !~ '[A-Z]';

ALTER TABLE public.school_signup_access
  ADD CONSTRAINT school_signup_access_access_code_check CHECK (
    char_length(access_code) BETWEEN 8 AND 32
    AND access_code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
    AND access_code ~ '[A-Z]'
  );

COMMENT ON COLUMN public.school_signup_access.access_code IS
  'Server-only school enrollment code. Administrators may use a generated code or an 8-32 character custom uppercase code containing letters and numbers.';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS eligible_grades SMALLINT[];

UPDATE public.opportunities
SET eligible_grades = ARRAY(
  SELECT generate_series(
    GREATEST(9, COALESCE(grade_min, 9)),
    LEAST(12, COALESCE(grade_max, 12))
  )
)::SMALLINT[]
WHERE eligible_grades IS NULL OR cardinality(eligible_grades) = 0;

ALTER TABLE public.opportunities
  ALTER COLUMN eligible_grades SET DEFAULT ARRAY[9, 10, 11, 12]::SMALLINT[],
  ALTER COLUMN eligible_grades SET NOT NULL;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_eligible_grades_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_eligible_grades_check CHECK (
    cardinality(eligible_grades) > 0
    AND eligible_grades <@ ARRAY[9, 10, 11, 12]::SMALLINT[]
  );

COMMENT ON COLUMN public.opportunities.eligible_grades IS
  'Exact high-school grades allowed to participate; grade_min and grade_max remain populated for backwards-compatible summaries.';

-- The original internal function retains the complete reviewed state machine.
-- Change only its separation-of-duties guard: school and district requesters
-- still cannot review their own requests, while the ultimate platform authority
-- may advance its own password-confirmed, fully audited workflow.
DO $migration$
DECLARE
  function_definition TEXT;
  old_guard TEXT := $guard$  IF request.requested_by = actor.id THEN
    RAISE EXCEPTION 'The requester cannot review their own offboarding request';
  END IF;$guard$;
  new_guard TEXT := $guard$  IF request.requested_by = actor.id AND actor.role <> 'super_admin' THEN
    RAISE EXCEPTION 'The requester cannot review their own offboarding request';
  END IF;$guard$;
BEGIN
  SELECT pg_get_functiondef(
    'public.review_tenant_offboarding_request_internal(uuid,text,text,text,timestamptz,text)'::REGPROCEDURE
  ) INTO function_definition;

  IF position(old_guard IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not update the tenant offboarding self-review guard';
  END IF;

  EXECUTE replace(function_definition, old_guard, new_guard);
END;
$migration$;

COMMENT ON FUNCTION public.review_tenant_offboarding_request(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) IS
  'Advances an offboarding request behind legal-hold and tenant locks. Platform administrators may advance their own audited request; lower scopes retain reviewer separation.';

COMMIT;
