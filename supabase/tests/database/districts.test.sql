BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(14);

SELECT is(
  (SELECT name FROM public.districts WHERE slug = 'elkhorn-public-schools'),
  'Elkhorn Public Schools',
  'the verified Elkhorn district is backfilled'
);

SELECT is(
  (
    SELECT d.slug
    FROM public.schools s
    JOIN public.districts d ON d.id = s.district_id
    WHERE s.slug = 'elkhorn-south'
  ),
  'elkhorn-public-schools',
  'Elkhorn South is attached to Elkhorn Public Schools'
);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES (
  'd1000000-0000-4000-8000-000000000002',
  'Outside Test District',
  'outside-test-district',
  'Elsewhere',
  'NE'
);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'b1000000-0000-4000-8000-000000000099',
  'd1000000-0000-4000-8000-000000000002',
  'Outside Test School',
  'outside-test-school',
  TRUE,
  TRUE,
  ARRAY['outside.test']
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '61000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'district-admin@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"District Admin"}',
    NOW(), NOW()
  ),
  (
    '61000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'district-student@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"District Student"}',
    NOW(), NOW()
  ),
  (
    '61000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'outside-student@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outside Student"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'district_admin',
    district_id = 'd0000000-0000-4000-8000-000000000001',
    school_id = NULL
WHERE id = '61000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET school_id = 'a0000000-0000-4000-8000-000000000001'
WHERE id = '61000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET school_id = 'b1000000-0000-4000-8000-000000000099'
WHERE id = '61000000-0000-4000-8000-000000000003';

SELECT is(
  (
    SELECT district_id
    FROM public.profiles
    WHERE id = '61000000-0000-4000-8000-000000000002'
  ),
  'd0000000-0000-4000-8000-000000000001'::UUID,
  'school users inherit their school district'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.can_admin_district('d0000000-0000-4000-8000-000000000001'),
  'district administrators can administer their assigned district'
);
SELECT isnt(
  public.can_admin_district('d1000000-0000-4000-8000-000000000002'),
  TRUE,
  'district administrators cannot administer another district'
);
SELECT ok(
  public.can_admin_school('a0000000-0000-4000-8000-000000000001'),
  'district administrators can administer a school in their district'
);
SELECT isnt(
  public.can_admin_school('b1000000-0000-4000-8000-000000000099'),
  TRUE,
  'district administrators cannot administer a school outside their district'
);
SELECT is(
  (SELECT count(*) FROM public.districts),
  1::BIGINT,
  'district administrators can read only their assigned district'
);
SELECT is(
  (
    SELECT public.get_admin_statistics(NULL, NULL)->>'scopeDistrictId'
  ),
  'd0000000-0000-4000-8000-000000000001',
  'district-wide statistics stay pinned to the assigned district'
);
SELECT lives_ok(
  $$
    SELECT public.set_school_signup_domains(
      'a0000000-0000-4000-8000-000000000001',
      ARRAY['*']
    )
  $$,
  'district administrators can change signup domains for their schools'
);
SELECT throws_ok(
  $$
    SELECT public.set_school_signup_domains(
      'b1000000-0000-4000-8000-000000000099',
      ARRAY['*']
    )
  $$,
  'P0001',
  'District administrators can only update schools in their district',
  'district administrators cannot change signup domains outside their district'
);
SELECT lives_ok(
  $$
    SELECT public.admin_set_user_role_and_clubs(
      '61000000-0000-4000-8000-000000000002',
      'admin',
      ARRAY[]::UUID[]
    )
  $$,
  'district administrators can promote a school-level account in their district'
);
SELECT throws_ok(
  $$
    SELECT public.admin_set_user_role_and_clubs(
      '61000000-0000-4000-8000-000000000003',
      'admin',
      ARRAY[]::UUID[]
    )
  $$,
  'P0001',
  'District administrators can only manage school-level accounts in their district',
  'district administrators cannot change roles outside their district'
);
SELECT throws_ok(
  $$
    SELECT public.get_admin_statistics(
      'b1000000-0000-4000-8000-000000000099',
      NULL
    )
  $$,
  'P0001',
  'District administrators can only view schools in their district',
  'district administrators cannot request out-of-district statistics'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
