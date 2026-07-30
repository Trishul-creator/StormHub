BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(53);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES
  (
    'f9100000-0000-4000-8000-000000000001',
    'Deletion Test District',
    'deletion-test-district',
    'Omaha',
    'NE'
  ),
  (
    'f9100000-0000-4000-8000-000000000002',
    'Outside Deletion District',
    'outside-deletion-district',
    'Lincoln',
    'NE'
  );

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES
  (
    'f9200000-0000-4000-8000-000000000001',
    'f9100000-0000-4000-8000-000000000001',
    'Deletion Test High School',
    'deletion-test-high',
    TRUE,
    TRUE,
    ARRAY['deletion.test']
  ),
  (
    'f9200000-0000-4000-8000-000000000002',
    'f9100000-0000-4000-8000-000000000002',
    'Outside Deletion High School',
    'outside-deletion-high',
    TRUE,
    TRUE,
    ARRAY['outside-deletion.test']
  );

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'f9300000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion Student"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'teacher@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion Teacher"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-target@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion School Administrator"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'district-target@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion District Administrator"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform-target@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion Platform Administrator"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'platform-reviewer@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion Platform Reviewer"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@outside-deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outside Deletion Student"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-reviewer@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion School Reviewer"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'district-reviewer@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Deletion District Reviewer"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'district-reviewer@outside-deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outside Deletion District Reviewer"}',
    NOW(), NOW()
  ),
  (
    'f9300000-0000-4000-8000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ordinary-delete@deletion.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Ordinary Deletion Student"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET school_id = 'f9200000-0000-4000-8000-000000000001'
WHERE id IN (
  'f9300000-0000-4000-8000-000000000001',
  'f9300000-0000-4000-8000-000000000002',
  'f9300000-0000-4000-8000-000000000003',
  'f9300000-0000-4000-8000-000000000008',
  'f9300000-0000-4000-8000-000000000011'
);

UPDATE public.profiles
SET role = 'teacher'
WHERE id = 'f9300000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  'f9300000-0000-4000-8000-000000000003',
  'f9300000-0000-4000-8000-000000000008'
);

UPDATE public.profiles
SET role = 'district_admin',
    school_id = NULL,
    district_id = 'f9100000-0000-4000-8000-000000000001'
WHERE id IN (
  'f9300000-0000-4000-8000-000000000004',
  'f9300000-0000-4000-8000-000000000009'
);

UPDATE public.profiles
SET role = 'super_admin',
    school_id = NULL,
    district_id = NULL
WHERE id IN (
  'f9300000-0000-4000-8000-000000000005',
  'f9300000-0000-4000-8000-000000000006'
);

UPDATE public.profiles
SET school_id = 'f9200000-0000-4000-8000-000000000002'
WHERE id = 'f9300000-0000-4000-8000-000000000007';

UPDATE public.profiles
SET role = 'district_admin',
    school_id = NULL,
    district_id = 'f9100000-0000-4000-8000-000000000002'
WHERE id = 'f9300000-0000-4000-8000-000000000010';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO public.account_deletion_requests (
      user_id, target_user_id_snapshot, requester_role, scope_type, school_id
    ) VALUES (
      'f9300000-0000-4000-8000-000000000001',
      'f9300000-0000-4000-8000-000000000001',
      'student',
      'school',
      'f9200000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'authenticated users cannot forge account-deletion requests directly'
);

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('Please remove my account.') $$,
  'students can submit their own derived account-deletion request'
);

SELECT is(
  (
    SELECT concat_ws(
      '|',
      requester_role,
      scope_type,
      school_id::TEXT,
      district_id::TEXT
    )
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
  ),
  'student|school|f9200000-0000-4000-8000-000000000001|f9100000-0000-4000-8000-000000000001',
  'student request scope is derived from the live school profile'
);

SELECT is(
  (SELECT count(*) FROM public.account_deletion_requests),
  1::BIGINT,
  'requesters can read their own request'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
    )
  ),
  TRUE,
  'requesters cannot review their own account-deletion request'
);

SELECT throws_ok(
  $$ SELECT public.submit_account_deletion_request('Duplicate request.') $$,
  '23505',
  NULL,
  'a requester cannot create a second pending request'
);

SELECT throws_ok(
  $$
    UPDATE public.account_deletion_requests
    SET reason = 'Changed directly'
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'authenticated users cannot update account-deletion requests directly'
);

SELECT throws_ok(
  $$
    DELETE FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'authenticated users cannot delete account-deletion requests directly'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('Teacher deletion request.') $$,
  'teachers can submit their own deletion request'
);

SELECT is(
  (
    SELECT concat_ws('|', requester_role, scope_type, school_id::TEXT)
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000002'
  ),
  'teacher|school|f9200000-0000-4000-8000-000000000001',
  'teacher requests retain a school-scope snapshot'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('School admin deletion request.') $$,
  'school administrators can request deletion without self-authorizing it'
);

SELECT is(
  (
    SELECT concat_ws('|', requester_role, scope_type, school_id::TEXT)
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000003'
  ),
  'admin|school|f9200000-0000-4000-8000-000000000001',
  'school-administrator requests retain school scope'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('District admin deletion request.') $$,
  'district administrators can submit a district-scoped deletion request'
);

SELECT is(
  (
    SELECT concat_ws(
      '|',
      requester_role,
      scope_type,
      COALESCE(school_id::TEXT, 'none'),
      district_id::TEXT
    )
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000004'
  ),
  'district_admin|district|none|f9100000-0000-4000-8000-000000000001',
  'district-administrator requests cannot carry a caller-selected school'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('Platform admin deletion request.') $$,
  'platform administrators can submit a platform-scoped deletion request'
);

SELECT is(
  (
    SELECT concat_ws(
      '|',
      requester_role,
      scope_type,
      COALESCE(school_id::TEXT, 'none'),
      COALESCE(district_id::TEXT, 'none')
    )
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
  ),
  'super_admin|platform|none|none',
  'platform-administrator requests cannot carry school or district scope'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
    )
  ),
  TRUE,
  'a platform administrator cannot review their own request'
);

SELECT throws_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
      ),
      'approve',
      'Self approval must fail.'
    )
  $$,
  'P0001',
  'Account deletion requests require an independent reviewer',
  'the review RPC independently rejects self-approval'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.submit_account_deletion_request('Outside student deletion request.') $$,
  'a second district requester can submit an isolated request'
);

SELECT is(
  (
    SELECT district_id
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000007'
  ),
  'f9100000-0000-4000-8000-000000000002'::UUID,
  'the outside student request derives its own district'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.account_deletion_requests),
  2::BIGINT,
  'school administrators read only student and teacher requests in their school'
);

SELECT ok(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
    )
  ),
  'school administrators can review student requests in their school'
);

SELECT ok(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000002'
    )
  ),
  'school administrators can review teacher requests in their school'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000003'
    )
  ),
  TRUE,
  'school administrators cannot review another school administrator'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000007'
    )
  ),
  TRUE,
  'school administrators cannot review another school request'
);

SELECT lives_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
      ),
      'approve',
      'School administrator independently approved the student request.'
    )
  $$,
  'school administrators can approve student deletion requests'
);

SELECT lives_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000002'
      ),
      'reject',
      'Teacher chose to retain the account.'
    )
  $$,
  'school administrators can reject teacher deletion requests'
);

SELECT is(
  (
    SELECT status
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000002'
  ),
  'rejected',
  'a rejected request reaches a terminal status'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.account_deletion_requests),
  3::BIGINT,
  'district administrators read school-user requests in their district'
);

SELECT ok(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000003'
    )
  ),
  'district administrators can review school-administrator requests'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000004'
    )
  ),
  TRUE,
  'district administrators cannot review district-administrator requests'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000007'
    )
  ),
  TRUE,
  'district administrators cannot cross district boundaries'
);

SELECT lives_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000003'
      ),
      'approve',
      'District administrator approved the school administrator request.'
    )
  $$,
  'district administrators can approve school-administrator deletion requests'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000010","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.account_deletion_requests),
  1::BIGINT,
  'an outside district administrator reads only its district requests'
);

SELECT isnt(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000003'
    )
  ),
  TRUE,
  'an outside district administrator cannot review the first district'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f9300000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.account_deletion_requests),
  6::BIGINT,
  'an independent platform administrator reads all reviewable requests'
);

SELECT ok(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000004'
    )
  ),
  'platform administrators can review district-administrator requests'
);

SELECT lives_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000004'
      ),
      'approve',
      'Platform administrator approved the district administrator request.'
    )
  $$,
  'platform administrators can approve district-administrator deletion requests'
);

SELECT ok(
  public.can_review_account_deletion_request(
    (
      SELECT id
      FROM public.account_deletion_requests
      WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
    )
  ),
  'a different platform administrator can review a platform request'
);

SELECT lives_ok(
  $$
    SELECT public.review_account_deletion_request(
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
      ),
      'approve',
      'Independent platform administrator approved the request.'
    )
  $$,
  'a different platform administrator can approve a platform request'
);

SELECT is(
  (
    SELECT status
    FROM public.account_deletion_requests
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
  ),
  'approved',
  'approved elevated requests remain durable and retryable'
);

RESET ROLE;

SELECT isnt(
  has_function_privilege(
    'service_role',
    'public.prepare_user_account_deletion_internal(uuid)',
    'EXECUTE'
  ),
  TRUE,
  'the destructive internal preparation function is not callable by service_role'
);

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'f9300000-0000-4000-8000-000000000005'
    )
  $$,
  'P0001',
  'An approved account deletion request is required for elevated administrators',
  'the ordinary preparation signature rejects elevated accounts'
);

SELECT throws_ok(
  $$
    UPDATE public.account_deletion_requests
    SET school_id = 'f9200000-0000-4000-8000-000000000002'
    WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'Account deletion request scope and request details are immutable',
  'even service operations cannot rewrite a request scope snapshot'
);

RESET ROLE;

-- The preceding review runs as the platform reviewer. Clear that simulated
-- request identity before the service performs administrative account-state
-- changes, otherwise the profile self-protection trigger correctly treats the
-- fixture cleanup as a user trying to suspend their own account.
SELECT set_config('request.jwt.claims', '{}', TRUE);
SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    UPDATE public.profiles
    SET account_status = 'suspended'
    WHERE role = 'super_admin'
      AND account_status = 'active'
      AND id <> 'f9300000-0000-4000-8000-000000000005'
  $$,
  'other platform administrators can be deactivated while one remains active'
);

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET account_status = 'suspended'
    WHERE id = 'f9300000-0000-4000-8000-000000000005'
  $$,
  'P0001',
  'The last active platform administrator cannot be deleted or deactivated',
  'the profile trigger atomically protects the final active platform administrator'
);

SELECT throws_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'f9300000-0000-4000-8000-000000000005',
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
      )
    )
  $$,
  'P0001',
  'The last active platform administrator cannot be deleted',
  'approved preparation rechecks the last-active-super invariant'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    UPDATE public.profiles
    SET account_status = 'active'
    WHERE id = 'f9300000-0000-4000-8000-000000000006'
  $$,
  'a second platform administrator can be restored before deletion'
);

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'f9300000-0000-4000-8000-000000000005',
      (
        SELECT id
        FROM public.account_deletion_requests
        WHERE target_user_id_snapshot = 'f9300000-0000-4000-8000-000000000005'
      )
    )
  $$,
  'an independently approved elevated account can be prepared when another platform administrator remains'
);

SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'f9300000-0000-4000-8000-000000000005'
  ),
  'deactivated',
  'elevated preparation deactivates the target before external identity deletion'
);

SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE target_user_id = 'f9300000-0000-4000-8000-000000000005'
  ),
  'prepared',
  'elevated preparation creates the durable execution barrier'
);

SELECT lives_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'f9300000-0000-4000-8000-000000000011'
    )
  $$,
  'the one-argument signature still supports ordinary requestless deletion'
);

SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'f9300000-0000-4000-8000-000000000011'
  ),
  'deactivated',
  'ordinary deletion preparation still deactivates the target'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
