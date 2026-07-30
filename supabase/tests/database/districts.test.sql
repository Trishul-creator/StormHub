BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(25);

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
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SELECT lives_ok(
  $$
    SELECT public.update_district_details(
      target_district_id => 'd0000000-0000-4000-8000-000000000001',
      requested_name => 'Elkhorn Public Schools Updated',
      requested_city => 'Elkhorn',
      requested_state => 'NE',
      requested_website_url => 'https://www.elkhornweb.org'
    )
  $$,
  'district administrators can edit descriptive details for their own district'
);
SELECT is(
  (
    SELECT name
    FROM public.districts
    WHERE id = 'd0000000-0000-4000-8000-000000000001'
  ),
  'Elkhorn Public Schools Updated',
  'district edits are saved'
);
SELECT throws_ok(
  $$
    SELECT public.update_district_details(
      target_district_id => 'd1000000-0000-4000-8000-000000000002',
      requested_name => 'Unauthorized change'
    )
  $$,
  'P0001',
  'Administrator access required for this district',
  'district administrators cannot edit another district'
);
SELECT throws_ok(
  $$
    SELECT public.update_district_details(
      target_district_id => 'd0000000-0000-4000-8000-000000000001',
      requested_name => 'Elkhorn Public Schools Updated',
      requested_slug => 'district-admin-cannot-change-this'
    )
  $$,
  'P0001',
  'Only platform administrators can change district routing or availability',
  'district administrators cannot change district URLs'
);
SELECT lives_ok(
  $$
    SELECT public.update_school_details(
      target_school_id => 'a0000000-0000-4000-8000-000000000001',
      requested_name => 'Elkhorn South High School Updated',
      requested_short_name => 'ESHS',
      requested_city => 'Omaha',
      requested_state => 'NE',
      requested_website_url => 'https://eshs.elkhornweb.org',
      requested_mascot => 'Storm',
      requested_primary_color => '#123ABC',
      requested_secondary_color => '#FFFFFF'
    )
  $$,
  'district administrators can edit schools in their own district'
);
SELECT throws_ok(
  $$
    SELECT public.update_school_details(
      target_school_id => 'b1000000-0000-4000-8000-000000000099',
      requested_name => 'Unauthorized school change'
    )
  $$,
  'P0001',
  'Administrator access required for this school',
  'district administrators cannot edit schools outside their district'
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);
SELECT is(
  (SELECT count(*) FROM public.districts),
  1::BIGINT,
  'district administrators can read only their assigned district'
);
SELECT is(
  (SELECT count(*) FROM public.schools),
  1::BIGINT,
  'district administrators can read only schools assigned to their district'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.schools
    WHERE id = 'b1000000-0000-4000-8000-000000000099'
  ),
  0::BIGINT,
  'district administrators cannot resolve a school outside their district'
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

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.update_school_details(
      target_school_id => 'a0000000-0000-4000-8000-000000000001',
      requested_name => 'School Admin Updated Name',
      requested_short_name => 'SAUN',
      requested_address => '20303 Blue Sage Parkway',
      requested_city => 'Omaha',
      requested_state => 'NE',
      requested_zip => '68130',
      requested_website_url => 'https://eshs.elkhornweb.org',
      requested_logo_url => 'https://eshs.elkhornweb.org/logo.png',
      requested_mascot => 'Storm',
      requested_primary_color => '#112233',
      requested_secondary_color => '#AABBCC'
    )
  $$,
  'school administrators can edit descriptive details for their own school'
);
SELECT is(
  (
    SELECT name
    FROM public.schools
    WHERE id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'School Admin Updated Name',
  'school-admin edits are saved'
);
SELECT throws_ok(
  $$
    SELECT public.update_school_details(
      target_school_id => 'a0000000-0000-4000-8000-000000000001',
      requested_name => 'School Admin Updated Name',
      requested_slug => 'school-admin-cannot-change-this'
    )
  $$,
  'P0001',
  'Only district or platform administrators can change school routing or availability',
  'school administrators cannot change school URLs or availability'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
