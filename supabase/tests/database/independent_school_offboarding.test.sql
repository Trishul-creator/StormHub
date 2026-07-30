BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(18);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Independent School Test District',
  'independent-school-test-district',
  'Omaha',
  'NE'
);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'f2000000-0000-4000-8000-000000000001',
  NULL,
  'Independent Test High School',
  'independent-test-high',
  TRUE,
  TRUE,
  ARRAY['independent-offboarding.test']
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'f3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'school-admin@independent-offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Independent School Admin"}',
    NOW(), NOW()
  ),
  (
    'f3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'district-admin@independent-offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Unrelated District Admin"}',
    NOW(), NOW()
  ),
  (
    'f3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform-admin@independent-offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Independent Test Platform Admin"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'admin',
    school_id = 'f2000000-0000-4000-8000-000000000001',
    district_id = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'district_admin',
    district_id = 'f1000000-0000-4000-8000-000000000001',
    school_id = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET role = 'super_admin',
    school_id = NULL,
    district_id = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000003';

SELECT is(
  (
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_offboarding_requests'
      AND column_name = 'district_id'
  ),
  'YES',
  'independent-school requests may preserve a null district scope'
);

SELECT is(
  (
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_offboarding_events'
      AND column_name = 'district_id'
  ),
  'YES',
  'independent-school event evidence may preserve a null district scope'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'f2000000-0000-4000-8000-000000000001',
      'The independent school requested an export and end-of-contract deletion.'
    )
  $$,
  'an independent-school administrator can submit its own audited request'
);

SELECT is(
  (
    SELECT district_id
    FROM public.tenant_offboarding_requests
    WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  NULL::UUID,
  'the request records the independent school without inventing a district'
);

SELECT is(
  (
    SELECT district_id
    FROM public.tenant_offboarding_events
    WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  NULL::UUID,
  'the append-only event records the same independent scope'
);

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  1::BIGINT,
  'the school administrator can read its independent-school request'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  0::BIGINT,
  'an unrelated district administrator cannot read an independent-school request'
);

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'f2000000-0000-4000-8000-000000000001',
      'A district administrator must not claim an independent school.'
    )
  $$,
  'P0001',
  'District administrators can only request offboarding inside their district',
  'a district administrator cannot submit for an independent school'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  1::BIGINT,
  'the platform administrator can read the independent-school request'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
      ),
      'under_review',
      'Platform privacy staff acknowledged the independent-school request.'
    )
  $$,
  'the platform administrator can begin independent-school review'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
      ),
      'export_ready',
      'The protected independent-school export was verified.',
      'vault://independent-school/export-001'
    )
  $$,
  'the independent-school export can be recorded'
);

RESET ROLE;

SELECT throws_ok(
  $$
    UPDATE public.schools
    SET district_id = 'f1000000-0000-4000-8000-000000000001'
    WHERE id = 'f2000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'School district membership is frozen by an active offboarding export or purge',
  'an independent school cannot be attached to a district after export'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
      ),
      'approved',
      'Platform approval completed after export verification.'
    )
  $$,
  'platform approval can deactivate an independent school'
);

SELECT is(
  (SELECT is_active FROM public.schools WHERE id = 'f2000000-0000-4000-8000-000000000001'),
  FALSE,
  'approval deactivates the independent school'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'f3000000-0000-4000-8000-000000000001'
  ),
  'deactivated',
  'approval deactivates the independent-school account'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.cancel_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'f2000000-0000-4000-8000-000000000001'
      ),
      'The school renewed its agreement before the physical deletion window.'
    )
  $$,
  'the platform administrator can restore an approved independent school'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT is(
  (SELECT is_active FROM public.schools WHERE id = 'f2000000-0000-4000-8000-000000000001'),
  TRUE,
  'cancellation restores the independent school state'
);

SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'f3000000-0000-4000-8000-000000000001'
  ),
  'active',
  'cancellation restores the independent-school account state'
);

SELECT * FROM finish();

ROLLBACK;
