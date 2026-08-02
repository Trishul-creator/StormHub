BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(4);

INSERT INTO public.schools (id, name, slug, is_active, is_public, allowed_email_domains)
VALUES (
  'fb200000-0000-4000-8000-000000000001',
  'Workflow Refinement High School',
  'workflow-refinement-high',
  TRUE,
  TRUE,
  ARRAY['workflow.test']
);

INSERT INTO public.opportunities (
  id, school_id, title, slug, category, eligible_grades, grade_min, grade_max,
  status, visibility
) VALUES (
  'fb400000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000001',
  'Ninth and Eleventh Grade Program',
  'ninth-eleventh-program',
  'Academic',
  ARRAY[9, 11]::SMALLINT[],
  9,
  11,
  'approved',
  'public'
);

SELECT is(
  (
    SELECT eligible_grades
    FROM public.opportunities
    WHERE id = 'fb400000-0000-4000-8000-000000000001'
  ),
  ARRAY[9, 11]::SMALLINT[],
  'opportunities retain exact non-contiguous grade toggles'
);

SELECT throws_ok(
  $$
    UPDATE public.opportunities
    SET eligible_grades = ARRAY[8, 9]::SMALLINT[]
    WHERE id = 'fb400000-0000-4000-8000-000000000001'
  $$,
  '23514',
  NULL,
  'the database rejects grades outside the supported high-school range'
);

SELECT lives_ok(
  $$
    UPDATE public.school_signup_access
    SET access_code = 'EAGLES-2026'
    WHERE school_id = 'fb200000-0000-4000-8000-000000000001'
  $$,
  'a school can use an administrator-defined access code'
);

SELECT ok(
  public.verify_school_signup_code(
    'fb200000-0000-4000-8000-000000000001',
    'eagles-2026'
  ),
  'custom access codes remain case-insensitive during signup verification'
);

SELECT * FROM finish();
ROLLBACK;
