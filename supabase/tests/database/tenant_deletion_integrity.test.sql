BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.schools', 'DELETE'),
  'authenticated administrators cannot directly delete school tenants'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.districts', 'DELETE'),
  'authenticated administrators cannot directly delete district tenants'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.legal_holds'::REGCLASS
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid IN (
        'public.schools'::REGCLASS,
        'public.districts'::REGCLASS
      )
  ),
  0::BIGINT,
  'legal-hold scope UUIDs intentionally outlive tenant rows'
);
SELECT is(
  (
    SELECT constraint_row.confdeltype::TEXT
    FROM pg_constraint constraint_row
    WHERE constraint_row.conname = 'platform_support_sessions_school_id_fkey'
  ),
  'n',
  'support sessions preserve history by nulling a deleted school reference'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM pg_constraint constraint_row
    WHERE constraint_row.conname IN (
      'platform_support_access_log_session_id_fkey',
      'platform_support_access_log_school_id_fkey'
    )
      AND constraint_row.confdeltype = 'n'
  ),
  2::BIGINT,
  'support access logs survive both session and school deletion'
);

INSERT INTO public.districts (id, name, slug, is_active)
VALUES (
  'f2400000-0000-4000-8000-000000000001',
  'Deletion Integrity District',
  'deletion-integrity-district',
  TRUE
);

INSERT INTO public.schools (
  id,
  district_id,
  name,
  slug,
  is_active,
  is_public,
  allowed_email_domains
) VALUES (
  'f2400000-0000-4000-8000-000000000002',
  'f2400000-0000-4000-8000-000000000001',
  'Deletion Integrity School',
  'deletion-integrity-school',
  TRUE,
  TRUE,
  ARRAY['deletion-integrity.test']
);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  'f2400000-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'platform-admin@deletion-integrity.test',
  '',
  NOW(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Deletion Integrity Platform Admin"}',
  NOW(),
  NOW()
);

UPDATE public.profiles
SET role = 'super_admin',
    school_id = NULL,
    district_id = NULL,
    account_status = 'active'
WHERE id = 'f2400000-0000-4000-8000-000000000003';

INSERT INTO public.platform_support_sessions (
  id,
  actor_user_id,
  school_id,
  reason,
  expires_at
) VALUES (
  'f2400000-0000-4000-8000-000000000004',
  'f2400000-0000-4000-8000-000000000003',
  'f2400000-0000-4000-8000-000000000002',
  'Verify preservation during a tenant purge',
  NOW() + INTERVAL '30 minutes'
);

INSERT INTO public.platform_support_access_log (
  id,
  session_id,
  actor_user_id,
  school_id,
  action,
  resource_type
) VALUES (
  'f2400000-0000-4000-8000-000000000005',
  'f2400000-0000-4000-8000-000000000004',
  'f2400000-0000-4000-8000-000000000003',
  'f2400000-0000-4000-8000-000000000002',
  'view',
  'tenant_deletion_test'
);

INSERT INTO public.legal_holds (
  id,
  scope_type,
  district_id,
  school_id,
  category,
  reason,
  placed_by,
  released_by,
  released_at,
  release_reason
) VALUES (
  'f2400000-0000-4000-8000-000000000006',
  'school',
  'f2400000-0000-4000-8000-000000000001',
  'f2400000-0000-4000-8000-000000000002',
  'audit',
  'Preserve the tenant deletion integrity test record',
  'f2400000-0000-4000-8000-000000000003',
  'f2400000-0000-4000-8000-000000000003',
  NOW(),
  'The test preservation condition is complete'
);

DELETE FROM public.clubs
WHERE school_id = 'f2400000-0000-4000-8000-000000000002';
DELETE FROM public.schools
WHERE id = 'f2400000-0000-4000-8000-000000000002';

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.platform_support_sessions
    WHERE id = 'f2400000-0000-4000-8000-000000000004'
  ),
  1::BIGINT,
  'deleting a school does not delete its support session history'
);
SELECT is(
  (
    SELECT school_id
    FROM public.platform_support_sessions
    WHERE id = 'f2400000-0000-4000-8000-000000000004'
  ),
  NULL::UUID,
  'a preserved support session no longer references the deleted school'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.platform_support_access_log
    WHERE id = 'f2400000-0000-4000-8000-000000000005'
      AND school_id IS NULL
  ),
  1::BIGINT,
  'deleting a school preserves and detaches its support access log'
);
SELECT is(
  (
    SELECT school_id
    FROM public.legal_holds
    WHERE id = 'f2400000-0000-4000-8000-000000000006'
  ),
  'f2400000-0000-4000-8000-000000000002'::UUID,
  'released legal-hold evidence retains the immutable school scope UUID'
);

DELETE FROM public.platform_support_sessions
WHERE id = 'f2400000-0000-4000-8000-000000000004';

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.platform_support_access_log
    WHERE id = 'f2400000-0000-4000-8000-000000000005'
      AND session_id IS NULL
  ),
  1::BIGINT,
  'deleting an expired support session preserves its access log'
);

INSERT INTO public.schools (
  id,
  district_id,
  name,
  slug,
  is_active,
  is_public,
  allowed_email_domains
) VALUES (
  'f2400000-0000-4000-8000-000000000007',
  'f2400000-0000-4000-8000-000000000001',
  'Marker Integrity School',
  'marker-integrity-school',
  TRUE,
  TRUE,
  ARRAY['marker-integrity.test']
);

SELECT throws_ok(
  $$
    UPDATE public.schools
    SET access_disabled_at = NOW()
    WHERE id = 'f2400000-0000-4000-8000-000000000007'
  $$,
  'P0001',
  'Tenant access markers must be set or cleared together',
  'a tenant suspension timestamp cannot be written without its approved request'
);

INSERT INTO public.tenant_offboarding_requests (
  id,
  scope_type,
  school_id,
  district_id,
  requested_by,
  request_reason,
  status,
  export_reference,
  approved_by,
  approved_at,
  tenant_state_before,
  deactivated_by,
  deactivated_at
) VALUES (
  'f2400000-0000-4000-8000-000000000008',
  'school',
  'f2400000-0000-4000-8000-000000000007',
  'f2400000-0000-4000-8000-000000000001',
  'f2400000-0000-4000-8000-000000000003',
  'Test the immutable offboarding access marker',
  'approved',
  'protected-export-reference',
  'f2400000-0000-4000-8000-000000000003',
  NOW(),
  '{"scope_type":"school","is_active":true,"is_public":true}'::JSONB,
  'f2400000-0000-4000-8000-000000000003',
  NOW()
);

UPDATE public.schools
SET access_disabled_at = NOW(),
    access_disabled_by_offboarding_request =
      'f2400000-0000-4000-8000-000000000008'
WHERE id = 'f2400000-0000-4000-8000-000000000007';

SELECT is(
  (
    SELECT access_disabled_by_offboarding_request
    FROM public.schools
    WHERE id = 'f2400000-0000-4000-8000-000000000007'
  ),
  'f2400000-0000-4000-8000-000000000008'::UUID,
  'an approved matching offboarding request can suspend its school'
);

SELECT throws_ok(
  $$
    UPDATE public.schools
    SET access_disabled_at = NULL,
        access_disabled_by_offboarding_request = NULL
    WHERE id = 'f2400000-0000-4000-8000-000000000007'
  $$,
  'P0001',
  'Tenant access markers are controlled by the offboarding workflow',
  'direct writes cannot clear an active offboarding access marker'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f2400000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  TRUE
);

UPDATE public.tenant_offboarding_requests
SET status = 'cancelled',
    cancelled_by = 'f2400000-0000-4000-8000-000000000003',
    cancelled_at = NOW()
WHERE id = 'f2400000-0000-4000-8000-000000000008';

SELECT is(
  (
    SELECT access_disabled_by_offboarding_request
    FROM public.schools
    WHERE id = 'f2400000-0000-4000-8000-000000000007'
  ),
  NULL::UUID,
  'cancelling the recorded request clears only its own school marker'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    DELETE FROM public.schools
    WHERE id = 'f2400000-0000-4000-8000-000000000007'
  $$,
  '42501',
  'permission denied for table schools',
  'even a platform session cannot bypass the tenant offboarding workflow with direct DELETE'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
