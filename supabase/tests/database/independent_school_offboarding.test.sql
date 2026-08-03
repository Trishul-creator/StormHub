BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(14);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES ('f1000000-0000-4000-8000-000000000001', 'Independent School Test District', 'independent-school-test-district', 'Omaha', 'NE');
INSERT INTO public.schools (id, district_id, name, slug, is_active, is_public, allowed_email_domains)
VALUES ('f2000000-0000-4000-8000-000000000001', NULL, 'Independent Test High School', 'independent-test-high', TRUE, TRUE, ARRAY['independent-offboarding.test']);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('f3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school-admin@independent-offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Independent School Admin"}', NOW(), NOW()),
  ('f3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'district-admin@independent-offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Unrelated District Admin"}', NOW(), NOW()),
  ('f3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform-admin@independent-offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Independent Platform Admin"}', NOW(), NOW());

UPDATE public.profiles SET role = 'admin', school_id = 'f2000000-0000-4000-8000-000000000001', district_id = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'district_admin', district_id = 'f1000000-0000-4000-8000-000000000001', school_id = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000002';
UPDATE public.profiles SET role = 'super_admin', school_id = NULL, district_id = NULL, account_status = 'active'
WHERE id = 'f3000000-0000-4000-8000-000000000003';

SELECT is((SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_offboarding_requests' AND column_name = 'district_id'), 'YES', 'independent-school requests preserve a null district scope');
SELECT is((SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_offboarding_events' AND column_name = 'district_id'), 'YES', 'independent-school events preserve a null district scope');

SELECT set_config('request.jwt.claims', '{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'f2000000-0000-4000-8000-000000000001', 'The school requested an export and contract-end deletion.') $$,
  'P0001', 'Active platform administrator access required',
  'independent-school administrators cannot submit offboarding requests'
);
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'independent-school administrators cannot read offboarding records');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'f2000000-0000-4000-8000-000000000001', 'The district attempted to offboard an independent school.') $$,
  'P0001', 'Active platform administrator access required',
  'district administrators cannot submit independent-school offboarding requests'
);
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'district administrators cannot read independent-school offboarding records');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'f2000000-0000-4000-8000-000000000001', 'The platform owner recorded the independent-school export and deletion instruction.') $$,
  'platform administrators can submit independent-school offboarding requests'
);
SELECT is((SELECT district_id FROM public.tenant_offboarding_requests WHERE school_id = 'f2000000-0000-4000-8000-000000000001'), NULL::UUID, 'the request does not invent a district');
SELECT is((SELECT district_id FROM public.tenant_offboarding_events WHERE school_id = 'f2000000-0000-4000-8000-000000000001'), NULL::UUID, 'the event evidence preserves the independent scope');
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 1::BIGINT, 'platform administrators can read the independent-school request');
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'under_review', 'Platform privacy staff acknowledged the independent-school request.') $$,
  'platform administrators can begin independent-school review'
);
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'export_ready', 'The protected independent-school export was verified.', 'vault://independent/export-001') $$,
  'platform administrators can record independent-school export evidence'
);
SELECT lives_ok(
  $$ SELECT public.cancel_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'The school renewed service before approval or deletion.') $$,
  'platform administrators can cancel independent-school offboarding'
);
SELECT is((SELECT status FROM public.tenant_offboarding_requests LIMIT 1), 'cancelled', 'the cancelled independent-school request remains in evidence history');

SELECT * FROM finish();
ROLLBACK;
