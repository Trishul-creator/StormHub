BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(21);

SELECT has_function(
  'public',
  'assign_district_administrator',
  ARRAY['uuid', 'uuid'],
  'district-administrator assignment has one transactional RPC'
);

SELECT has_function(
  'public',
  'record_platform_support_access',
  ARRAY['uuid', 'text', 'text', 'uuid'],
  'platform support views have an audited RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.record_platform_support_access(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot record or probe platform support access'
);

SELECT isnt(
  has_function_privilege(
    'authenticated',
    'public.review_tenant_offboarding_request_internal(uuid,text,text,text,timestamptz,text)',
    'EXECUTE'
  ),
  TRUE,
  'authenticated callers cannot bypass the offboarding review barriers'
);

SELECT isnt(
  has_function_privilege(
    'authenticated',
    'public.cancel_tenant_offboarding_request_internal(uuid,text)',
    'EXECUTE'
  ),
  TRUE,
  'authenticated callers cannot bypass the offboarding restore barriers'
);

INSERT INTO public.districts (id, name, slug, city, state, is_active)
VALUES (
  'fa100000-0000-4000-8000-000000000001',
  'Transition Integrity District',
  'transition-integrity-district',
  'Omaha',
  'NE',
  TRUE
);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'fa200000-0000-4000-8000-000000000001',
  NULL,
  'Transition Source High School',
  'transition-source-high',
  TRUE,
  TRUE,
  ARRAY['transition-integrity.test']
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'fa300000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform@transition-integrity.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Transition Platform Admin"}',
    NOW(), NOW()
  ),
  (
    'fa300000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'target@transition-integrity.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Transition Target"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'super_admin',
    school_id = NULL,
    district_id = NULL
WHERE id = 'fa300000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'student',
    school_id = 'fa200000-0000-4000-8000-000000000001'
WHERE id = 'fa300000-0000-4000-8000-000000000002';

INSERT INTO public.clubs (
  id, school_id, name, slug, status, is_listed, is_active, visibility
) VALUES
  (
    'fa400000-0000-4000-8000-000000000001',
    'fa200000-0000-4000-8000-000000000001',
    'Active Transition Club',
    'active-transition-club',
    'active',
    TRUE,
    TRUE,
    'public'
  ),
  (
    'fa400000-0000-4000-8000-000000000002',
    'fa200000-0000-4000-8000-000000000001',
    'Pending Transition Club',
    'pending-transition-club',
    'active',
    TRUE,
    TRUE,
    'public'
  );

INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES
  (
    'fa400000-0000-4000-8000-000000000001',
    'fa300000-0000-4000-8000-000000000002',
    'active',
    'president'
  ),
  (
    'fa400000-0000-4000-8000-000000000002',
    'fa300000-0000-4000-8000-000000000002',
    'pending',
    'member'
  );

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'fa300000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    ))
  )::TEXT,
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.assign_district_administrator(
      'fa300000-0000-4000-8000-000000000002',
      'fa100000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'Platform administrator access required',
  'a user cannot promote their own account'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'fa300000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'oauth',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    ))
  )::TEXT,
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.assign_district_administrator(
      'fa300000-0000-4000-8000-000000000002',
      'fa100000-0000-4000-8000-000000000001'
    )
  $$,
  'a platform administrator can assign exact district scope'
);

RESET ROLE;

SELECT is(
  (
    SELECT role
    FROM public.profiles
    WHERE id = 'fa300000-0000-4000-8000-000000000002'
  ),
  'district_admin',
  'the promoted account receives the district-administrator role'
);

SELECT is(
  (
    SELECT school_id
    FROM public.profiles
    WHERE id = 'fa300000-0000-4000-8000-000000000002'
  ),
  NULL::UUID,
  'the promoted account no longer carries old school scope'
);

SELECT is(
  (
    SELECT district_id
    FROM public.profiles
    WHERE id = 'fa300000-0000-4000-8000-000000000002'
  ),
  'fa100000-0000-4000-8000-000000000001'::UUID,
  'the promoted account receives only the selected district scope'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.club_memberships
    WHERE user_id = 'fa300000-0000-4000-8000-000000000002'
      AND status IN ('active', 'pending')
  ),
  0::BIGINT,
  'promotion removes every active or pending old-tenant membership path'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.club_memberships
    WHERE user_id = 'fa300000-0000-4000-8000-000000000002'
      AND status = 'left'
      AND role = 'member'
  ),
  2::BIGINT,
  'terminalized memberships retain no leadership privilege'
);

SELECT ok(
  pg_get_functiondef(
    'public.review_tenant_offboarding_request(uuid,text,text,text,timestamptz,text)'::REGPROCEDURE
  ) LIKE '%stormhub:legal-hold-execution-barrier%',
  'offboarding review acquires the legal-hold transition barrier'
);

SELECT ok(
  pg_get_functiondef(
    'public.review_tenant_offboarding_request(uuid,text,text,text,timestamptz,text)'::REGPROCEDURE
  ) LIKE '%tenant_offboarding_scope_lock_key%',
  'offboarding review acquires the tenant-tree transition barrier before work'
);

SELECT ok(
  pg_get_functiondef(
    'public.cancel_tenant_offboarding_request(uuid,text)'::REGPROCEDURE
  ) LIKE '%stormhub:legal-hold-execution-barrier%',
  'offboarding restoration acquires the legal-hold transition barrier'
);

SELECT ok(
  pg_get_functiondef(
    'public.cancel_tenant_offboarding_request(uuid,text)'::REGPROCEDURE
  ) LIKE '%tenant_offboarding_scope_lock_key%',
  'offboarding restoration acquires the tenant-tree transition barrier before work'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.admin_audit_log
    WHERE actor_user_id = 'fa300000-0000-4000-8000-000000000001'
      AND entity_type IN ('profiles', 'club_memberships')
  ) > 0,
  TRUE,
  'elevated assignment remains visible in the administrative audit trail'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fa300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.record_platform_support_access(
    'fa200000-0000-4000-8000-000000000001',
    'view',
    'school_opportunity_inventory',
    'fa200000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'platform support access cannot be recorded without an active exact-school session'
);

RESET ROLE;

INSERT INTO public.platform_support_sessions (
  id,
  actor_user_id,
  school_id,
  reason,
  started_at,
  expires_at
) VALUES (
  'fa500000-0000-4000-8000-000000000001',
  'fa300000-0000-4000-8000-000000000001',
  'fa200000-0000-4000-8000-000000000001',
  'Verify audited platform support access.',
  NOW(),
  NOW() + INTERVAL '30 minutes'
);

SET LOCAL ROLE authenticated;

SELECT is(
  public.record_platform_support_access(
    'fa200000-0000-4000-8000-000000000001',
    'view',
    'school_opportunity_inventory',
    'fa200000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'an active exact-school support session records the private read'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM public.platform_support_access_log
    WHERE session_id = 'fa500000-0000-4000-8000-000000000001'
      AND actor_user_id = 'fa300000-0000-4000-8000-000000000001'
      AND school_id = 'fa200000-0000-4000-8000-000000000001'
      AND action = 'view'
      AND resource_type = 'school_opportunity_inventory'
  ),
  1::BIGINT,
  'the access evidence captures session, actor, school, action, and resource'
);

SET LOCAL ROLE authenticated;

SELECT is(
  public.record_platform_support_access(
    'fa200000-0000-4000-8000-000000000099',
    'view',
    'school_opportunity_inventory',
    NULL
  ),
  FALSE,
  'an active support session never authorizes a different school'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
