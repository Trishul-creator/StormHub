BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(23);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'Offboarding Test District', 'offboarding-test-district', 'Omaha', 'NE'),
  ('e1000000-0000-4000-8000-000000000002', 'Outside Offboarding District', 'outside-offboarding-district', 'Lincoln', 'NE');

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Offboarding Test High School', 'offboarding-test-high', TRUE, TRUE, ARRAY['offboarding.test']),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Outside Offboarding High School', 'outside-offboarding-high', TRUE, TRUE, ARRAY['outside-offboarding.test']);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('e3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school-admin@offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Offboarding School Admin"}', NOW(), NOW()),
  ('e3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'district-admin@offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Offboarding District Admin"}', NOW(), NOW()),
  ('e3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outside-admin@offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Outside District Admin"}', NOW(), NOW()),
  ('e3000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform-admin@offboarding.test', '', NOW(), '{"provider":"google","providers":["google"]}', '{"full_name":"Offboarding Platform Admin"}', NOW(), NOW());

UPDATE public.profiles SET role = 'admin', school_id = 'e2000000-0000-4000-8000-000000000001'
WHERE id = 'e3000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'district_admin', district_id = 'e1000000-0000-4000-8000-000000000001'
WHERE id = 'e3000000-0000-4000-8000-000000000002';
UPDATE public.profiles SET role = 'district_admin', district_id = 'e1000000-0000-4000-8000-000000000002'
WHERE id = 'e3000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET role = 'super_admin', account_status = 'active'
WHERE id = 'e3000000-0000-4000-8000-000000000004';

SELECT is(
  (SELECT count(*) FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid IN ('public.tenant_offboarding_requests'::REGCLASS, 'public.tenant_offboarding_events'::REGCLASS) AND c.confrelid IN ('public.schools'::REGCLASS, 'public.districts'::REGCLASS)),
  0::BIGINT,
  'offboarding evidence can outlive a verified tenant-row purge'
);

SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO public.tenant_offboarding_requests (scope_type, school_id, district_id, requested_by, request_reason) VALUES ('school', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Attempt to bypass the protected request function.') $$,
  '42501', NULL, 'authenticated users cannot insert offboarding records directly'
);
SELECT throws_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'e2000000-0000-4000-8000-000000000001', 'The school requested a managed export and deletion.') $$,
  'P0001', 'Active platform administrator access required',
  'school administrators cannot submit tenant offboarding requests'
);
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'school administrators cannot read offboarding requests');
SELECT is((SELECT count(*) FROM public.tenant_offboarding_events), 0::BIGINT, 'school administrators cannot read offboarding events');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'e2000000-0000-4000-8000-000000000001', 'The district requested school tenant deletion.') $$,
  'P0001', 'Active platform administrator access required',
  'district administrators cannot submit school offboarding requests'
);
SELECT throws_ok(
  $$ SELECT public.submit_tenant_offboarding_request('district', 'e1000000-0000-4000-8000-000000000001', 'The district requested full tenant deletion.') $$,
  'P0001', 'Active platform administrator access required',
  'district administrators cannot submit district offboarding requests'
);
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'district administrators cannot read offboarding requests');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.submit_tenant_offboarding_request('school', 'e2000000-0000-4000-8000-000000000001', 'The platform owner recorded the contract-end export and deletion instruction.') $$,
  'platform administrators can submit school offboarding requests'
);
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 1::BIGINT, 'platform administrators can read offboarding requests');
SELECT is((SELECT count(*) FROM public.tenant_offboarding_events), 1::BIGINT, 'platform administrators can read append-only events');
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'under_review', 'Platform privacy staff acknowledged the request.') $$,
  'platform administrators can begin review'
);
SELECT throws_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'export_ready', 'The export was reviewed.') $$,
  'P0001', 'Record the protected export or preservation reference first',
  'export-ready status requires a protected export reference'
);
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'export_ready', 'The protected export was verified.', 'vault://school/export-001') $$,
  'platform administrators can record protected export evidence'
);
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'approved', 'The platform owner approved recoverable tenant deactivation.') $$,
  'platform administrators can approve tenant offboarding'
);
SELECT throws_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'scheduled', 'Invalid past schedule.', NULL, NOW() - INTERVAL '1 hour') $$,
  'P0001', 'Choose a future deletion window',
  'the scheduled deletion date and time must be in the future'
);
SELECT lives_ok(
  $$ SELECT public.review_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'scheduled', 'Deletion is scheduled after the review window.', NULL, NOW() + INTERVAL '7 days') $$,
  'platform administrators can schedule a future deletion date and time'
);
SELECT is((SELECT status FROM public.tenant_offboarding_requests LIMIT 1), 'scheduled', 'the request retains its scheduled status');
SELECT lives_ok(
  $$ SELECT public.cancel_tenant_offboarding_request((SELECT id FROM public.tenant_offboarding_requests LIMIT 1), 'The tenant renewed service before the physical purge.') $$,
  'platform administrators can cancel and restore a scheduled tenant'
);
SELECT is((SELECT is_active::TEXT || ':' || is_public::TEXT FROM public.schools WHERE id = 'e2000000-0000-4000-8000-000000000001'), 'true:true', 'cancellation restores school availability');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'school administrators cannot read completed offboarding history');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.tenant_offboarding_requests), 0::BIGINT, 'district administrators cannot read completed offboarding history');

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ DELETE FROM public.tenant_offboarding_requests $$,
  '42501', NULL, 'platform administrators cannot delete workflow evidence directly'
);

SELECT * FROM finish();
ROLLBACK;
