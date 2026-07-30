BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(24);

INSERT INTO public.districts (id, name, slug, is_active)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Release Gate District', 'release-gate-district', TRUE),
  ('a1000000-0000-4000-8000-000000000002', 'Hold Test District', 'hold-test-district', TRUE);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
)
VALUES
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Release Gate High', 'release-gate-high', TRUE, TRUE, ARRAY['release.test']
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Prior Child High', 'prior-child-high', TRUE, TRUE, ARRAY['child.test']
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'Audit Evidence High', 'audit-evidence-high', TRUE, TRUE, ARRAY['audit.test']
  ),
  (
    'a2000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002',
    'Hold Test High', 'hold-test-high', TRUE, TRUE, ARRAY['hold.test']
  );

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    'a3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform@release.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Release Platform Admin"}', NOW(), NOW()
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@release.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Release Student"}', NOW(), NOW()
  ),
  (
    'a3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'support-actor@release.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Departing Support Actor"}', NOW(), NOW()
  ),
  (
    'a3000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@hold.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Held Student"}', NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'super_admin', school_id = NULL, district_id = NULL
WHERE id IN (
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003'
);
UPDATE public.profiles
SET role = 'student', school_id = 'a2000000-0000-4000-8000-000000000001'
WHERE id = 'a3000000-0000-4000-8000-000000000002';
UPDATE public.profiles
SET role = 'student', school_id = 'a2000000-0000-4000-8000-000000000004'
WHERE id = 'a3000000-0000-4000-8000-000000000004';

INSERT INTO public.platform_support_sessions (
  id, actor_user_id, school_id, reason, started_at, expires_at
) VALUES (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000003',
  'Verify durable support evidence.',
  NOW(),
  NOW() + INTERVAL '30 minutes'
);
INSERT INTO public.platform_support_access_log (
  id, session_id, actor_user_id, school_id, action, resource_type
) VALUES (
  'a5000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000003',
  'view',
  'profile_inventory'
);

DELETE FROM public.profiles
WHERE id = 'a3000000-0000-4000-8000-000000000003';

SELECT is(
  (SELECT actor_user_id FROM public.platform_support_sessions WHERE id = 'a4000000-0000-4000-8000-000000000001'),
  NULL::UUID,
  'support sessions survive actor-profile deletion'
);
SELECT is(
  (SELECT actor_user_id FROM public.platform_support_access_log WHERE id = 'a5000000-0000-4000-8000-000000000001'),
  NULL::UUID,
  'support access evidence survives actor-profile deletion'
);

DELETE FROM public.clubs
WHERE school_id = 'a2000000-0000-4000-8000-000000000003';
DELETE FROM public.schools
WHERE id = 'a2000000-0000-4000-8000-000000000003';

SELECT is(
  (SELECT school_id FROM public.platform_support_sessions WHERE id = 'a4000000-0000-4000-8000-000000000001'),
  NULL::UUID,
  'support sessions retain an anonymized school UUID slot after tenant purge'
);
SELECT is(
  (SELECT school_id FROM public.platform_support_access_log WHERE id = 'a5000000-0000-4000-8000-000000000001'),
  NULL::UUID,
  'support access evidence survives school deletion'
);

DELETE FROM public.platform_support_sessions
WHERE id = 'a4000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT session_id FROM public.platform_support_access_log WHERE id = 'a5000000-0000-4000-8000-000000000001'),
  NULL::UUID,
  'support access evidence survives retention of its parent session'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.legal_holds'::REGCLASS
      AND constraint_row.confrelid IN (
        'public.schools'::REGCLASS,
        'public.districts'::REGCLASS
      )
  ),
  0::BIGINT,
  'legal-hold scope UUIDs can outlive a verified tenant purge'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.has_active_legal_hold(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot probe legal-hold state across tenant scopes'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.schools', 'DELETE')
    AND NOT has_table_privilege('authenticated', 'public.districts', 'DELETE'),
  'authenticated administration cannot physically delete tenant rows'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school',
      'a1000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000004',
      'all',
      'This deliberately uses a mismatched district.',
      NULL
    )
  $$,
  'P0001',
  'The legal-hold district does not match the selected school',
  'school legal holds derive and validate their canonical district'
);
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'global', NULL, NULL, 'all',
      'This expiration is deliberately in the past.',
      NOW() - INTERVAL '1 minute'
    )
  $$,
  'P0001',
  'A legal-hold expiration must be in the future',
  'legal holds cannot be created already expired'
);

RESET ROLE;
INSERT INTO public.data_retention_runs (id, status, started_at)
VALUES ('a6000000-0000-4000-8000-000000000001', 'running', NOW());
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school', NULL, 'a2000000-0000-4000-8000-000000000004',
      'all', 'A running retention job must win the shared barrier.', NULL
    )
  $$,
  'P0001',
  'A data-retention run is active; retry the legal hold after it completes',
  'legal-hold placement cannot race an active retention execution'
);

RESET ROLE;
UPDATE public.data_retention_runs
SET status = 'completed', completed_at = NOW()
WHERE id = 'a6000000-0000-4000-8000-000000000001';
INSERT INTO public.account_deletion_executions (
  id, target_user_id, school_id, district_id, status
) VALUES (
  'a7000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000002',
  'prepared'
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school', NULL, 'a2000000-0000-4000-8000-000000000004',
      'all', 'A prepared account deletion must win the shared barrier.', NULL
    )
  $$,
  'P0001',
  'An account deletion is already prepared in this scope; retry the legal hold after it finishes',
  'legal-hold placement cannot overtake prepared account deletion'
);

RESET ROLE;
UPDATE public.account_deletion_executions
SET status = 'auth_delete_failed', updated_at = NOW()
WHERE id = 'a7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school', NULL, 'a2000000-0000-4000-8000-000000000004',
      'all', 'An unresolved external deletion failure remains a barrier.', NULL
    )
  $$,
  'P0001',
  'An account deletion is already prepared in this scope; retry the legal hold after it finishes',
  'unresolved authentication deletion failures keep the legal-hold barrier closed'
);

RESET ROLE;
UPDATE public.account_deletion_executions
SET status = 'failed', updated_at = NOW() - INTERVAL '400 days'
WHERE id = 'a7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE release_gate_hold_ids (id UUID PRIMARY KEY);
INSERT INTO release_gate_hold_ids (id)
SELECT public.place_legal_hold(
  'school', NULL, 'a2000000-0000-4000-8000-000000000004',
  'all', 'Preserve all records for the focused release-gate test.', NOW() + INTERVAL '30 days'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'a3000000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'An active legal hold blocks account deletion',
  'account deletion rechecks legal holds while owning the shared barrier'
);
SELECT throws_ok(
  $$
    SELECT public.delete_retention_batch(
      'account_deletion_executions',
      NOW(),
      NULL,
      10
    )
  $$,
  'P0001',
  'An active legal hold blocks retention deletion',
  'the retention deletion primitive cannot bypass an active legal hold'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT is(
  public.release_legal_hold(
    (SELECT id FROM release_gate_hold_ids),
    'The preservation obligation has been formally released.'
  ),
  TRUE,
  'platform administrators can release a validated legal hold'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is(
  public.delete_retention_batch(
    'account_deletion_executions',
    NOW(),
    NULL,
    10
  ),
  1,
  'retention removes only terminal account-deletion execution records'
);
SELECT is(
  public.delete_retention_batch(
    'platform_support_access_log',
    NOW() + INTERVAL '1 day',
    NULL,
    10
  ),
  1,
  'retention explicitly supports durable platform support access history'
);

RESET ROLE;
INSERT INTO public.tenant_offboarding_requests (
  id, scope_type, school_id, district_id, requested_by, request_reason,
  status, export_reference
) VALUES (
  'a8000000-0000-4000-8000-000000000001',
  'school',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'This request exercises the access-marker release gate.',
  'export_ready',
  'release-test/export-1'
);
UPDATE public.schools
SET is_active = FALSE, is_public = FALSE
WHERE id = 'a2000000-0000-4000-8000-000000000001';
UPDATE public.profiles
SET account_status = 'deactivated'
WHERE id = 'a3000000-0000-4000-8000-000000000002';

UPDATE public.tenant_offboarding_requests
SET status = 'approved',
    approved_by = 'a3000000-0000-4000-8000-000000000001',
    approved_at = NOW(),
    tenant_state_before = '{"scope_type":"school","is_active":true,"is_public":true}'::JSONB,
    deactivated_by = 'a3000000-0000-4000-8000-000000000001',
    deactivated_at = NOW()
WHERE id = 'a8000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT access_disabled_by_offboarding_request
    FROM public.schools
    WHERE id = 'a2000000-0000-4000-8000-000000000001'
  ),
  'a8000000-0000-4000-8000-000000000001'::UUID,
  'approval installs the exact school offboarding access marker'
);
SELECT throws_ok(
  $$
    UPDATE public.schools
    SET access_disabled_at = NULL,
        access_disabled_by_offboarding_request = NULL
    WHERE id = 'a2000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'Tenant access markers are controlled by the offboarding workflow',
  'administrators cannot clear an approved tenant access marker directly'
);

SET CONSTRAINTS schools_disabled_tenant_final_state IMMEDIATE;
SELECT throws_ok(
  $$
    SELECT public.update_school_details(
      target_school_id => 'a2000000-0000-4000-8000-000000000001',
      requested_name => 'Release Gate High',
      requested_is_active => TRUE,
      requested_is_public => TRUE
    )
  $$,
  'P0001',
  'An offboarded school cannot be reactivated',
  'security-definer school management cannot reopen an offboarded tenant'
);
SET CONSTRAINTS schools_disabled_tenant_final_state DEFERRED;

SET CONSTRAINTS profiles_disabled_tenant_final_state IMMEDIATE;
SELECT throws_ok(
  $$
    SELECT public.admin_set_account_status(
      'a3000000-0000-4000-8000-000000000002',
      'active'
    )
  $$,
  'P0001',
  'Accounts in an offboarded tenant cannot be reactivated',
  'security-definer account management cannot reactivate an offboarded user'
);
SET CONSTRAINTS profiles_disabled_tenant_final_state DEFERRED;

RESET ROLE;
UPDATE public.tenant_offboarding_requests
SET status = 'cancelled',
    cancelled_by = 'a3000000-0000-4000-8000-000000000001',
    cancelled_at = NOW()
WHERE id = 'a8000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT access_disabled_by_offboarding_request
    FROM public.schools
    WHERE id = 'a2000000-0000-4000-8000-000000000001'
  ),
  NULL::UUID,
  'cancellation clears only the marker owned by its offboarding request'
);

RESET ROLE;
INSERT INTO public.tenant_offboarding_requests (
  id, scope_type, school_id, district_id, requested_by, request_reason,
  status, export_reference, tenant_state_before, deactivated_by, deactivated_at,
  scheduled_purge_at, completion_reference, completed_by, completed_at
) VALUES (
  'a8000000-0000-4000-8000-000000000002',
  'school',
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'This completed child workflow must retain its marker.',
  'completed',
  'release-test/child-export',
  '{"scope_type":"school","is_active":false,"is_public":false}'::JSONB,
  'a3000000-0000-4000-8000-000000000001',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day',
  'release-test/child-deletion-evidence',
  'a3000000-0000-4000-8000-000000000001',
  NOW()
);
UPDATE public.schools
SET is_active = FALSE,
    is_public = FALSE,
    access_disabled_at = NOW(),
    access_disabled_by_offboarding_request = 'a8000000-0000-4000-8000-000000000002'
WHERE id = 'a2000000-0000-4000-8000-000000000002';

INSERT INTO public.tenant_offboarding_requests (
  id, scope_type, district_id, requested_by, request_reason, status, export_reference
) VALUES (
  'a8000000-0000-4000-8000-000000000003',
  'district',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'This district workflow must not overwrite child evidence.',
  'export_ready',
  'release-test/district-export'
);
UPDATE public.districts
SET is_active = FALSE
WHERE id = 'a1000000-0000-4000-8000-000000000001';
UPDATE public.schools
SET is_active = FALSE, is_public = FALSE
WHERE district_id = 'a1000000-0000-4000-8000-000000000001';

UPDATE public.tenant_offboarding_requests
SET status = 'approved',
    approved_by = 'a3000000-0000-4000-8000-000000000001',
    approved_at = NOW(),
    tenant_state_before = '{"scope_type":"district","is_active":true,"schools":[]}'::JSONB,
    deactivated_by = 'a3000000-0000-4000-8000-000000000001',
    deactivated_at = NOW()
WHERE id = 'a8000000-0000-4000-8000-000000000003';

SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT access_disabled_by_offboarding_request
    FROM public.schools
    WHERE id = 'a2000000-0000-4000-8000-000000000002'
  ),
  'a8000000-0000-4000-8000-000000000002'::UUID,
  'district offboarding never overwrites a child school evidence marker'
);

SELECT * FROM finish();
ROLLBACK;
