BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(50);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES
  (
    'e1000000-0000-4000-8000-000000000001',
    'Offboarding Test District',
    'offboarding-test-district',
    'Omaha',
    'NE'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'Outside Offboarding District',
    'outside-offboarding-district',
    'Lincoln',
    'NE'
  );

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES
  (
    'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'Offboarding Test High School',
    'offboarding-test-high',
    TRUE,
    TRUE,
    ARRAY['offboarding.test']
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000002',
    'Outside Offboarding High School',
    'outside-offboarding-high',
    TRUE,
    TRUE,
    ARRAY['outside-offboarding.test']
  );

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'e3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'school-admin@offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Offboarding School Admin"}',
    NOW(), NOW()
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'district-admin@offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Offboarding District Admin"}',
    NOW(), NOW()
  ),
  (
    'e3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'outside-admin@offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outside District Admin"}',
    NOW(), NOW()
  ),
  (
    'e3000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform-admin@offboarding.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Offboarding Platform Admin"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'admin',
    school_id = 'e2000000-0000-4000-8000-000000000001'
WHERE id = 'e3000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'district_admin',
    district_id = 'e1000000-0000-4000-8000-000000000001'
WHERE id = 'e3000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET role = 'district_admin',
    district_id = 'e1000000-0000-4000-8000-000000000002'
WHERE id = 'e3000000-0000-4000-8000-000000000003';

UPDATE public.profiles
SET role = 'super_admin'
WHERE id = 'e3000000-0000-4000-8000-000000000004';

SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid IN (
        'public.tenant_offboarding_requests'::REGCLASS,
        'public.tenant_offboarding_events'::REGCLASS
      )
      AND constraint_row.confrelid IN (
        'public.schools'::REGCLASS,
        'public.districts'::REGCLASS
      )
  ),
  0::BIGINT,
  'offboarding evidence scope IDs can outlive a verified tenant-row purge'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO public.tenant_offboarding_requests (
      scope_type, school_id, district_id, requested_by, request_reason
    ) VALUES (
      'school',
      'e2000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      'e3000000-0000-4000-8000-000000000001',
      'Attempt to bypass the scoped request function.'
    )
  $$,
  '42501',
  NULL,
  'authenticated users cannot insert offboarding records directly'
);

SELECT lives_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'e2000000-0000-4000-8000-000000000001',
      'The school requested a managed export and end-of-contract data deletion.'
    )
  $$,
  'school administrators can request offboarding for their own school'
);

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'e2000000-0000-4000-8000-000000000001',
      'This duplicate active request must not create another workflow.'
    )
  $$,
  'P0001',
  'An active offboarding request already exists for this tenant',
  'only one active request is allowed for a tenant'
);

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'district',
      'e1000000-0000-4000-8000-000000000001',
      'A school administrator cannot offboard an entire district.'
    )
  $$,
  'P0001',
  'Only district or platform administrators can request district offboarding',
  'school administrators cannot request district offboarding'
);

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'e2000000-0000-4000-8000-000000000002',
      'A school administrator cannot request another school offboarding.'
    )
  $$,
  'P0001',
  'School administrators can only request offboarding for their own school',
  'school administrators cannot request offboarding for another school'
);

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  1::BIGINT,
  'school administrators read requests only for their own school'
);

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_events),
  1::BIGINT,
  'school administrators read the append-only event for their own request'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  0::BIGINT,
  'another district cannot read tenant offboarding requests'
);

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_events),
  0::BIGINT,
  'another district cannot read tenant offboarding history'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  1::BIGINT,
  'the assigned district administrator can read its school request'
);

SELECT throws_ok(
  $$
    UPDATE public.tenant_offboarding_requests
    SET status = 'completed'
    WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'authenticated administrators cannot bypass the review RPC'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'under_review',
      'District privacy staff acknowledged the request.'
    )
  $$,
  'a district administrator can acknowledge a school request'
);

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'export_ready',
      'Export preparation was reviewed.'
    )
  $$,
  'P0001',
  'Record the protected export or preservation reference first',
  'export-ready status requires a protected export reference'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'export_ready',
      'The district received the protected export.',
      'district-vault/export-2026-07-30'
    )
  $$,
  'a school request can be marked export ready with a reference'
);

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'approved',
      'The district authorized the documented deletion workflow.'
    )
  $$,
  'P0001',
  'Only a platform administrator can approve or schedule tenant deletion',
  'district administrators can prepare exports but cannot approve tenant deletion'
);

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'district',
      'e1000000-0000-4000-8000-000000000001',
      'The district requested a full tenant export and contract-end deletion.'
    )
  $$,
  'P0001',
  'Resolve active school offboarding requests before requesting district offboarding',
  'an active school request blocks an overlapping district request'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  1::BIGINT,
  'platform administrators can read the scoped school request'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'approved',
      'Platform privacy staff approved the recoverable deactivation.'
    )
  $$,
  'platform approval transactionally deactivates a school tenant'
);

SELECT is(
  (
    SELECT is_active::TEXT || ':' || is_public::TEXT
    FROM public.schools
    WHERE id = 'e2000000-0000-4000-8000-000000000001'
  ),
  'false:false',
  'approved school tenants become inactive and private'
);

-- Profile inventory is intentionally not directly readable by platform users.
-- Inspect the protected row as the test owner, then restore the platform JWT.
RESET ROLE;
SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'e3000000-0000-4000-8000-000000000001'
  ),
  'deactivated',
  'school approval deactivates the tenant profiles at the authorization boundary'
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT ok(
  (
    SELECT request.tenant_state_before IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.tenant_offboarding_profile_snapshots snapshot
        WHERE snapshot.request_id = request.id
          AND snapshot.profile_id = 'e3000000-0000-4000-8000-000000000001'
          AND snapshot.previous_account_status = 'active'
      )
    FROM public.tenant_offboarding_requests request
    WHERE request.school_id = 'e2000000-0000-4000-8000-000000000001'
  ),
  'approval captures tenant and account state for an exact restore'
);

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'scheduled',
      'Attempting an invalid past deletion window.',
      NULL,
      NOW() - INTERVAL '1 hour'
    )
  $$,
  'P0001',
  'Choose a future deletion window',
  'the deletion window must be in the future when it is scheduled'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'scheduled',
      'Deletion is scheduled after the district review window.',
      NULL,
      NOW() + INTERVAL '7 days'
    )
  $$,
  'approved requests can be placed in a documented deletion window'
);

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'completed',
      'Attempting completion without operator evidence.'
    )
  $$,
  'P0001',
  'The scheduled deletion window has not been reached',
  'completion is blocked until the scheduled deletion window'
);

RESET ROLE;
UPDATE public.tenant_offboarding_requests
SET scheduled_purge_at = NOW() - INTERVAL '1 minute'
WHERE school_id = 'e2000000-0000-4000-8000-000000000001';
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'completed',
      'Attempting completion without operator evidence.'
    )
  $$,
  'P0001',
  'Record the deletion evidence reference before completion',
  'completion requires an operator evidence reference after the window is reached'
);

SELECT lives_ok(
  $$
    SELECT public.cancel_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
      ),
      'The district renewed service before physical purge began.'
    )
  $$,
  'platform administrators can cancel and restore a scheduled school tenant'
);

SELECT is(
  (
    SELECT is_active::TEXT || ':' || is_public::TEXT
    FROM public.schools
    WHERE id = 'e2000000-0000-4000-8000-000000000001'
  ),
  'true:true',
  'cancelling before purge restores the exact school availability state'
);

RESET ROLE;
SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'e3000000-0000-4000-8000-000000000001'
  ),
  'active',
  'school cancellation restores the exact prior account status'
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT count(*)
    FROM public.tenant_offboarding_events
    WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
  ),
  8::BIGINT,
  'deactivation, scheduling, restoration, and status changes are append-only'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'district',
      'e1000000-0000-4000-8000-000000000001',
      'The district requested a full tenant export and contract-end deletion.'
    )
  $$,
  'district administrators can request offboarding after school workflows are resolved'
);

SELECT throws_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE scope_type = 'district'
          AND district_id = 'e1000000-0000-4000-8000-000000000001'
      ),
      'under_review',
      'The requester must not review this district request.'
    )
  $$,
  'P0001',
  'A higher-scope administrator must review this request',
  'district offboarding requires platform review'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'e2000000-0000-4000-8000-000000000001',
      'This nested school request must wait until district offboarding is resolved.'
    )
  $$,
  'P0001',
  'An active district offboarding request already covers this school',
  'an active district request blocks an overlapping child-school request'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE scope_type = 'district'
          AND district_id = 'e1000000-0000-4000-8000-000000000001'
      ),
      'under_review',
      'Platform privacy staff acknowledged the district request.'
    )
  $$,
  'platform administrators can review a district request'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE scope_type = 'district'
          AND district_id = 'e1000000-0000-4000-8000-000000000001'
      ),
      'export_ready',
      'The district-wide protected export was verified.',
      'district-vault/district-export-2026-07-30'
    )
  $$,
  'platform administrators can verify the district export'
);

SELECT lives_ok(
  $$
    SELECT public.review_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE scope_type = 'district'
          AND district_id = 'e1000000-0000-4000-8000-000000000001'
      ),
      'approved',
      'Platform privacy staff approved district deactivation.'
    )
  $$,
  'platform approval transactionally deactivates a district and its schools'
);

SELECT is(
  (
    SELECT is_active
    FROM public.districts
    WHERE id = 'e1000000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'approved district tenants become inactive'
);

SELECT is(
  (
    SELECT is_active::TEXT || ':' || is_public::TEXT
    FROM public.schools
    WHERE id = 'e2000000-0000-4000-8000-000000000001'
  ),
  'false:false',
  'district approval makes every child school inactive and private'
);

RESET ROLE;
SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'e3000000-0000-4000-8000-000000000002'
  ),
  'deactivated',
  'district approval deactivates the assigned district administrator'
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.cancel_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE scope_type = 'district'
          AND district_id = 'e1000000-0000-4000-8000-000000000001'
      ),
      'The district renewed service before physical purge began.'
    )
  $$,
  'platform administrators can restore an approved district tenant'
);

SELECT is(
  (
    SELECT is_active
    FROM public.districts
    WHERE id = 'e1000000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'district cancellation restores the district availability state'
);

SELECT is(
  (
    SELECT is_active::TEXT || ':' || is_public::TEXT
    FROM public.schools
    WHERE id = 'e2000000-0000-4000-8000-000000000001'
  ),
  'true:true',
  'district cancellation restores each child school state'
);

RESET ROLE;
SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'e3000000-0000-4000-8000-000000000002'
  ),
  'active',
  'district cancellation restores exact district account statuses'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.submit_tenant_offboarding_request(
      'school',
      'e2000000-0000-4000-8000-000000000001',
      'The school opened a later request to verify cancellation behavior.'
    )
  $$,
  'a cancelled request does not permanently block a later valid request'
);

SELECT lives_ok(
  $$
    SELECT public.cancel_tenant_offboarding_request(
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
          AND status = 'requested'
      ),
      'The school renewed service and withdrew the offboarding request.'
    )
  $$,
  'the original requester can cancel an early-stage request'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tenant_offboarding_requests
    WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
  ),
  2::BIGINT,
  'school administrators can see cancelled request history for their school'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tenant_offboarding_events
    WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
  ),
  10::BIGINT,
  'submission and early cancellation are retained after restored history'
);

SELECT throws_ok(
  $$
    DELETE FROM public.tenant_offboarding_requests
    WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'authenticated administrators cannot delete workflow evidence'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tenant_offboarding_events (
      request_id,
      district_id,
      school_id,
      actor_user_id,
      event_type,
      to_status
    ) VALUES (
      (
        SELECT id FROM public.tenant_offboarding_requests
        WHERE school_id = 'e2000000-0000-4000-8000-000000000001'
        LIMIT 1
      ),
      'e1000000-0000-4000-8000-000000000001',
      'e2000000-0000-4000-8000-000000000001',
      'e3000000-0000-4000-8000-000000000001',
      'status_changed',
      'completed'
    )
  $$,
  '42501',
  NULL,
  'authenticated users cannot forge offboarding history'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.tenant_offboarding_requests),
  0::BIGINT,
  'scope isolation still holds after the complete workflow'
);

SELECT * FROM finish();
ROLLBACK;
