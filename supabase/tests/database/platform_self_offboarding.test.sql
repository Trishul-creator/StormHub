BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(7);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES (
  'fa100000-0000-4000-8000-000000000001',
  'Platform-Owned Offboarding District',
  'platform-owned-offboarding',
  'Omaha',
  'NE'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'fa300000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'platform-owner@offboarding.test', '', NOW(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Platform Workflow Owner"}',
  NOW(), NOW()
);

UPDATE public.profiles
SET role = 'super_admin',
    school_id = NULL,
    district_id = NULL,
    account_status = 'active'
WHERE id = 'fa300000-0000-4000-8000-000000000001';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fa300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'district',
      'fa100000-0000-4000-8000-000000000001',
      'The platform administrator is handling this audited contract-end workflow.'
    )
  $$,
  'a platform administrator can submit a district offboarding request'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (SELECT id FROM public.tenant_offboarding_requests WHERE district_id = 'fa100000-0000-4000-8000-000000000001'),
      'under_review',
      'The same platform authority acknowledged the recorded instruction.'
    )
  $$,
  'the platform requester can acknowledge their own audited request'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (SELECT id FROM public.tenant_offboarding_requests WHERE district_id = 'fa100000-0000-4000-8000-000000000001'),
      'export_ready',
      'The protected export was verified by the platform authority.',
      'vault://platform-owned/export-001'
    )
  $$,
  'the platform requester can record export evidence'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (SELECT id FROM public.tenant_offboarding_requests WHERE district_id = 'fa100000-0000-4000-8000-000000000001'),
      'approved',
      'The platform authority approved deactivation after reviewing the export.'
    )
  $$,
  'the platform requester can approve the protected workflow'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (SELECT id FROM public.tenant_offboarding_requests WHERE district_id = 'fa100000-0000-4000-8000-000000000001'),
      'scheduled',
      'The evidence-backed purge window was scheduled.',
      'vault://platform-owned/export-001',
      NOW() + INTERVAL '2 days'
    )
  $$,
  'the platform requester can schedule the final deletion window'
);

SELECT is(
  (
    SELECT status
    FROM public.tenant_offboarding_requests
    WHERE district_id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'scheduled',
  'the self-managed request retains its reviewed status'
);

SELECT ok(
  (
    SELECT count(*) >= 6
    FROM public.tenant_offboarding_events
    WHERE district_id = 'fa100000-0000-4000-8000-000000000001'
      AND actor_user_id = 'fa300000-0000-4000-8000-000000000001'
  ),
  'every self-managed transition remains attributed in the audit history'
);

SELECT * FROM finish();
ROLLBACK;
