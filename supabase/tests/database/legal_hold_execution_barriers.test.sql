BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(58);

SELECT has_function(
  'public',
  'finalize_user_account_deletion',
  ARRAY['uuid', 'text', 'text'],
  'account deletion has a service finalizer'
);
SELECT has_function(
  'public',
  'finalize_coursework_attachment_removal',
  ARRAY['uuid', 'uuid', 'text', 'text'],
  'coursework removal has an atomic database finalizer'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.has_active_legal_hold(uuid,uuid)',
    'EXECUTE'
  ),
  FALSE,
  'authenticated users cannot probe confidential legal-hold scope'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.has_active_legal_hold(uuid,uuid)',
    'EXECUTE'
  ),
  TRUE,
  'the service role can enforce legal holds'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.finalize_user_account_deletion(uuid,text,text)',
    'EXECUTE'
  ),
  FALSE,
  'authenticated users cannot finalize deletion barriers'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.finalize_user_account_deletion(uuid,text,text)',
    'EXECUTE'
  ),
  TRUE,
  'the service role can finalize deletion barriers'
);
SELECT has_trigger(
  'public',
  'email_outbox',
  'email_outbox_enforce_active_recipient',
  'email queue writes enforce active recipients'
);
SELECT has_trigger(
  'public',
  'schools',
  'schools_enforce_offboarding_district_tree_freeze',
  'school district membership observes the offboarding freeze'
);

INSERT INTO public.districts (id, name, slug, city, state)
VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'Barrier Test District',
    'barrier-test-district',
    'Madison',
    'WI'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'Outside Barrier District',
    'outside-barrier-district',
    'Milwaukee',
    'WI'
  );

INSERT INTO public.schools (
  id,
  district_id,
  name,
  slug,
  is_active,
  is_public,
  allowed_email_domains
)
VALUES
  (
    'b2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'Barrier Test High School',
    'barrier-test-high',
    TRUE,
    TRUE,
    ARRAY['barrier.test']
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'Movable Barrier School',
    'movable-barrier-school',
    TRUE,
    TRUE,
    ARRAY['movable.barrier.test']
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000002',
    'Outside Barrier High School',
    'outside-barrier-high',
    TRUE,
    TRUE,
    ARRAY['outside.barrier.test']
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    NULL,
    'Independent Barrier School',
    'independent-barrier-school',
    TRUE,
    TRUE,
    ARRAY['independent.barrier.test']
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
)
VALUES
  (
    'b3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'platform@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Barrier Platform Admin"}',
    NOW(),
    NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'departing@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Departing Barrier Student"}',
    NOW(),
    NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outside@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outside Barrier Student"}',
    NOW(),
    NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'school-admin@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Barrier School Admin"}',
    NOW(),
    NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'capacity-student@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Capacity Barrier Student"}',
    NOW(),
    NOW()
  ),
  (
    'b3000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'email-race@barrier.test',
    '',
    NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Email Race Student"}',
    NOW(),
    NOW()
  );

UPDATE public.profiles
SET role = 'super_admin'
WHERE id = 'b3000000-0000-4000-8000-000000000001';
UPDATE public.profiles
SET school_id = 'b2000000-0000-4000-8000-000000000001'
WHERE id IN (
  'b3000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000005',
  'b3000000-0000-4000-8000-000000000006'
);
UPDATE public.profiles
SET school_id = 'b2000000-0000-4000-8000-000000000003'
WHERE id = 'b3000000-0000-4000-8000-000000000003';
UPDATE public.profiles
SET role = 'admin',
    school_id = 'b2000000-0000-4000-8000-000000000001'
WHERE id = 'b3000000-0000-4000-8000-000000000004';

INSERT INTO public.clubs (
  id,
  school_id,
  name,
  slug,
  status,
  is_listed,
  is_active,
  visibility
)
VALUES (
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'Barrier Coursework Club',
  'barrier-coursework-club',
  'active',
  TRUE,
  TRUE,
  'public'
);

INSERT INTO public.club_assignments (id, club_id, author_id, title, status, published_at)
VALUES
  (
    'b5000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Deletion Freeze Assignment',
    'published',
    NOW()
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Assignment Count Capacity',
    'published',
    NOW()
  ),
  (
    'b5000000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Assignment Byte Capacity',
    'published',
    NOW()
  ),
  (
    'b5000000-0000-4000-8000-000000000004',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Submission Count Capacity',
    'published',
    NOW()
  ),
  (
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Submission Byte Capacity',
    'published',
    NOW()
  ),
  (
    'b5000000-0000-4000-8000-000000000006',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000004',
    'Attachment Replay Assignment',
    'published',
    NOW()
  );

INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES (
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000005',
  'active',
  'member'
);

INSERT INTO public.coursework_upload_intents (
  id,
  user_id,
  assignment_id,
  target,
  storage_path,
  file_name,
  mime_type,
  expected_size,
  status,
  expires_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002',
  'b5000000-0000-4000-8000-000000000001',
  'submission',
  'b5000000-0000-4000-8000-000000000001/submissions/b3000000-0000-4000-8000-000000000002/pending.pdf',
  'pending.pdf',
  'application/pdf',
  9,
  'pending',
  NOW() + INTERVAL '10 minutes'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);

CREATE TEMP TABLE barrier_test_ids (
  name TEXT PRIMARY KEY,
  id UUID NOT NULL
);

INSERT INTO barrier_test_ids (name, id)
VALUES (
  'deletion-execution',
  public.prepare_user_account_deletion('b3000000-0000-4000-8000-000000000002')
);

SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution'),
  NULL::UUID,
  'deletion preparation returns a durable execution'
);
SELECT is(
  (
    SELECT status
    FROM public.coursework_upload_intents
    WHERE id = 'b6000000-0000-4000-8000-000000000001'
  ),
  'rejected',
  'deletion preparation freezes every pending upload intent'
);
SELECT is(
  (
    SELECT account_status
    FROM public.profiles
    WHERE id = 'b3000000-0000-4000-8000-000000000002'
  ),
  'deactivated',
  'the account is deactivated in the upload-freeze transaction'
);
SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE id = (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution')
  ),
  'prepared',
  'the prepared execution remains as the legal-hold barrier'
);
SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'b3000000-0000-4000-8000-000000000002',
      'b5000000-0000-4000-8000-000000000001',
      'submission',
      'b5000000-0000-4000-8000-000000000001/submissions/b3000000-0000-4000-8000-000000000002/late.pdf',
      'late.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'An active account is required',
  'no new upload intent can be created after the deletion freeze'
);
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school',
      'b1000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'all',
      'Prepared deletion must win this serialized transition.',
      NULL
    )
  $$,
  'P0001',
  'An account deletion is already prepared in this scope; retry the legal hold after it finishes',
  'an overlapping prepared deletion blocks legal-hold placement'
);

INSERT INTO barrier_test_ids (name, id)
VALUES (
  'outside-hold',
  public.place_legal_hold(
    'school',
    'b1000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000003',
    'all',
    'An unrelated school remains independently holdable.',
    NULL
  )
);
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'outside-hold'),
  NULL::UUID,
  'a prepared deletion only blocks overlapping hold scope'
);
SELECT ok(
  public.release_legal_hold(
    (SELECT id FROM barrier_test_ids WHERE name = 'outside-hold'),
    'The unrelated-scope test is complete.'
  ),
  'the unrelated legal hold can be released'
);
SELECT ok(
  public.finalize_user_account_deletion(
    (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution'),
    'failed',
    'External storage cleanup failed during the test.'
  ),
  'the service finalizer releases a failed prepared execution'
);
SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE id = (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution')
  ),
  'failed',
  'a failed deletion no longer remains a hold barrier'
);

INSERT INTO barrier_test_ids (name, id)
VALUES (
  'target-hold',
  public.place_legal_hold(
    'school',
    'b1000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'all',
    'A legal hold can be placed after failed cleanup releases the barrier.',
    NULL
  )
);
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'target-hold'),
  NULL::UUID,
  'the same scope becomes holdable after failure finalization'
);
SELECT throws_ok(
  $$
    SELECT public.prepare_user_account_deletion(
      'b3000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'An active legal hold blocks account deletion',
  'a hold committed first blocks deletion preparation'
);
SELECT ok(
  public.release_legal_hold(
    (SELECT id FROM barrier_test_ids WHERE name = 'target-hold'),
    'The hold-first conflict test is complete.'
  ),
  'the target legal hold can be released'
);
SELECT is(
  public.prepare_user_account_deletion('b3000000-0000-4000-8000-000000000002'),
  (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution'),
  'retrying a failed deletion reuses its durable execution'
);
SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE id = (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution')
  ),
  'prepared',
  'a retry restores the prepared barrier'
);
SELECT ok(
  public.finalize_user_account_deletion(
    (SELECT id FROM barrier_test_ids WHERE name = 'deletion-execution'),
    'failed',
    'Retry cleanup stopped intentionally for the test.'
  ),
  'the retried execution can be safely failed again'
);

INSERT INTO public.account_deletion_executions (
  id,
  target_user_id,
  school_id,
  district_id,
  status,
  prepared_at,
  updated_at
)
VALUES (
  'b8000000-0000-4000-8000-000000000003',
  'b8100000-0000-4000-8000-000000000003',
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'prepared',
  NOW() - INTERVAL '31 minutes',
  NOW() - INTERVAL '31 minutes'
);
INSERT INTO barrier_test_ids (name, id)
VALUES (
  'post-crash-hold',
  public.place_legal_hold(
    'school',
    'b1000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'all',
    'A crashed deletion worker cannot block emergency preservation forever.',
    NULL
  )
);
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'post-crash-hold'),
  NULL::UUID,
  'hold placement recovers an expired deletion-preparation lease'
);
SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE id = 'b8000000-0000-4000-8000-000000000003'
  ),
  'failed',
  'the expired prepared execution records a terminal failure'
);
SELECT ok(
  public.release_legal_hold(
    (SELECT id FROM barrier_test_ids WHERE name = 'post-crash-hold'),
    'The crashed deletion lease recovery test is complete.'
  ),
  'the post-crash legal hold can be released'
);

INSERT INTO barrier_test_ids (name, id)
VALUES (
  'independent-hold',
  public.place_legal_hold(
    'school',
    NULL,
    'b2000000-0000-4000-8000-000000000004',
    'all',
    'Independent schools require the same preservation protections.',
    NULL
  )
);
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'independent-hold'),
  NULL::UUID,
  'an independent school can receive a school-scoped legal hold'
);
SELECT is(
  (
    SELECT district_id
    FROM public.legal_holds
    WHERE id = (SELECT id FROM barrier_test_ids WHERE name = 'independent-hold')
  ),
  NULL::UUID,
  'an independent-school hold stores its canonical nullable district'
);
SELECT ok(
  public.has_active_legal_hold(
    NULL,
    'b2000000-0000-4000-8000-000000000004'
  ),
  'independent-school hold lookup matches by school'
);
SELECT is(
  public.begin_data_retention_run(),
  NULL::UUID,
  'retention refuses to start while any legal hold is active'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.data_retention_runs
    WHERE skipped_reason = 'Automatic retention paused by an active legal hold.'
  ),
  1::BIGINT,
  'the hold-blocked retention invocation records an observable skip'
);
SELECT ok(
  public.release_legal_hold(
    (SELECT id FROM barrier_test_ids WHERE name = 'independent-hold'),
    'The independent-school retention test is complete.'
  ),
  'the independent-school hold can be released'
);

INSERT INTO public.data_retention_runs (id, started_at, status)
VALUES (
  'b9000000-0000-4000-8000-000000000001',
  NOW() - INTERVAL '3 hours',
  'running'
);
INSERT INTO barrier_test_ids (name, id)
VALUES (
  'post-stale-hold',
  public.place_legal_hold(
    'global',
    NULL,
    NULL,
    'all',
    'A stale retention worker must not block emergency preservation.',
    NULL
  )
);
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'post-stale-hold'),
  NULL::UUID,
  'a stale retention lease is recovered before hold placement'
);
SELECT is(
  (
    SELECT status
    FROM public.data_retention_runs
    WHERE id = 'b9000000-0000-4000-8000-000000000001'
  ),
  'failed',
  'hold placement terminalizes the stale retention lease'
);
SELECT ok(
  public.release_legal_hold(
    (SELECT id FROM barrier_test_ids WHERE name = 'post-stale-hold'),
    'The stale worker recovery test is complete.'
  ),
  'the post-recovery global hold can be released'
);

INSERT INTO barrier_test_ids (name, id)
VALUES ('running-retention', public.begin_data_retention_run());
SELECT isnt(
  (SELECT id FROM barrier_test_ids WHERE name = 'running-retention'),
  NULL::UUID,
  'retention creates a running lease when no hold is active'
);
SELECT throws_ok(
  $$
    SELECT public.place_legal_hold(
      'school',
      'b1000000-0000-4000-8000-000000000002',
      'b2000000-0000-4000-8000-000000000003',
      'all',
      'A fresh retention run must win this serialized transition.',
      NULL
    )
  $$,
  'P0001',
  'A data-retention run is active; retry the legal hold after it completes',
  'a fresh retention lease blocks legal-hold placement'
);
UPDATE public.data_retention_runs
SET status = 'completed',
    completed_at = NOW()
WHERE id = (SELECT id FROM barrier_test_ids WHERE name = 'running-retention');

INSERT INTO public.account_deletion_executions (
  id,
  target_user_id,
  school_id,
  district_id,
  status,
  updated_at
)
VALUES
  (
    'b8000000-0000-4000-8000-000000000001',
    'b8100000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000002',
    'prepared',
    NOW() - INTERVAL '3 years'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'b8100000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000002',
    'failed',
    NOW() - INTERVAL '3 years'
  );
SELECT is(
  public.delete_retention_batch(
    'account_deletion_executions',
    NOW() - INTERVAL '2 years',
    NULL,
    500
  ),
  1,
  'retention deletes old terminal execution evidence'
);
SELECT is(
  (
    SELECT status
    FROM public.account_deletion_executions
    WHERE id = 'b8000000-0000-4000-8000-000000000001'
  ),
  'prepared',
  'retention never purges an in-flight prepared barrier'
);
SELECT is(
  public.delete_retention_batch(
    'platform_support_access_log',
    NOW() - INTERVAL '2 years',
    NULL,
    500
  ),
  0,
  'the retention allowlist accepts platform support access history'
);

INSERT INTO public.email_outbox (
  id,
  recipient_user_id,
  recipient_email,
  subject,
  body,
  type
)
VALUES (
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000006',
  'email-race@barrier.test',
  'Sensitive subject',
  'Sensitive body',
  'system_message'
);
SELECT pass('an active account can receive a queued email');
INSERT INTO barrier_test_ids (name, id)
VALUES (
  'email-deletion',
  public.prepare_user_account_deletion('b3000000-0000-4000-8000-000000000006')
);
SELECT results_eq(
  $$
    SELECT recipient_user_id, recipient_email, body, status, retryable
    FROM public.email_outbox
    WHERE id = 'ba000000-0000-4000-8000-000000000001'
  $$,
  $$
    VALUES (
      NULL::UUID,
      'deleted-b3000000-0000-4000-8000-000000000006@invalid.local'::TEXT,
      '[Message removed when the account was deleted.]'::TEXT,
      'failed'::TEXT,
      FALSE
    )
  $$,
  'deletion preparation scrubs a queue row that committed first'
);
SELECT throws_ok(
  $$
    INSERT INTO public.email_outbox (
      recipient_user_id,
      recipient_email,
      subject,
      body,
      type
    ) VALUES (
      'b3000000-0000-4000-8000-000000000006',
      'email-race@barrier.test',
      'Late sensitive subject',
      'Late sensitive body',
      'system_message'
    )
  $$,
  'P0001',
  'Email cannot be queued for an inactive account',
  'a queue insert that loses the profile lock race is rejected'
);
SELECT ok(
  public.finalize_user_account_deletion(
    (SELECT id FROM barrier_test_ids WHERE name = 'email-deletion'),
    'failed',
    'Email race test cleanup.'
  ),
  'the email-race deletion barrier can be released'
);

INSERT INTO public.tenant_offboarding_requests (
  id,
  scope_type,
  school_id,
  district_id,
  requested_by,
  request_reason,
  status,
  export_reference
)
VALUES (
  'bb000000-0000-4000-8000-000000000001',
  'district',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000004',
  'Freeze district membership after the protected export is ready.',
  'export_ready',
  'protected-export://barrier-test'
);
SELECT throws_ok(
  $$
    UPDATE public.schools
    SET district_id = 'b1000000-0000-4000-8000-000000000002'
    WHERE id = 'b2000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'School district membership is frozen by an active offboarding export or purge',
  'a school cannot leave a frozen source district'
);
SELECT throws_ok(
  $$
    UPDATE public.schools
    SET district_id = 'b1000000-0000-4000-8000-000000000001'
    WHERE id = 'b2000000-0000-4000-8000-000000000003'
  $$,
  'P0001',
  'School district membership is frozen by an active offboarding export or purge',
  'a school cannot enter a frozen target district'
);
SELECT throws_ok(
  $$
    INSERT INTO public.schools (
      id,
      district_id,
      name,
      slug,
      is_active,
      is_public,
      allowed_email_domains
    ) VALUES (
      'b2000000-0000-4000-8000-000000000005',
      'b1000000-0000-4000-8000-000000000001',
      'Late Frozen School',
      'late-frozen-school',
      TRUE,
      TRUE,
      ARRAY['late-frozen.barrier.test']
    )
  $$,
  'P0001',
  'School district membership is frozen by an active offboarding export or purge',
  'a school cannot be created inside a frozen district'
);
UPDATE public.tenant_offboarding_requests
SET status = 'rejected'
WHERE id = 'bb000000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$
    UPDATE public.schools
    SET district_id = 'b1000000-0000-4000-8000-000000000002'
    WHERE id = 'b2000000-0000-4000-8000-000000000002'
  $$,
  'district membership becomes writable after the freeze is terminalized'
);

INSERT INTO public.club_assignment_attachments (
  assignment_id,
  uploaded_by,
  source_type,
  copy_mode,
  file_name,
  mime_type,
  file_size,
  external_url,
  google_file_id
)
SELECT
  'b5000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000004',
  'google_drive',
  'reference',
  'count-' || item || '.pdf',
  'application/pdf',
  1,
  'https://drive.example/count-' || item,
  'assignment-count-' || item
FROM generate_series(1, 20) AS item;
INSERT INTO public.coursework_upload_intents (
  id, user_id, assignment_id, target, storage_path, file_name, mime_type,
  expected_size, status, expires_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000004',
  'b5000000-0000-4000-8000-000000000002',
  'assignment',
  'b5000000-0000-4000-8000-000000000002/materials/b3000000-0000-4000-8000-000000000004/over-count.pdf',
  'over-count.pdf',
  'application/pdf',
  1,
  'pending',
  NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      'b6000000-0000-4000-8000-000000000002',
      'b3000000-0000-4000-8000-000000000004',
      'b5000000-0000-4000-8000-000000000002',
      'assignment',
      'b5000000-0000-4000-8000-000000000002/materials/b3000000-0000-4000-8000-000000000004/over-count.pdf',
      'over-count.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'An assignment may have at most 20 attached materials',
  'registration re-counts the assignment attachment limit in its transaction'
);

INSERT INTO public.club_assignment_attachments (
  assignment_id,
  uploaded_by,
  source_type,
  copy_mode,
  file_name,
  mime_type,
  file_size,
  external_url,
  google_file_id
)
SELECT
  'b5000000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000004',
  'google_drive',
  'reference',
  'bytes-' || item || '.pdf',
  'application/pdf',
  20 * 1024 * 1024,
  'https://drive.example/bytes-' || item,
  'assignment-bytes-' || item
FROM generate_series(1, 10) AS item;
INSERT INTO public.coursework_upload_intents (
  id, user_id, assignment_id, target, storage_path, file_name, mime_type,
  expected_size, status, expires_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000004',
  'b5000000-0000-4000-8000-000000000003',
  'assignment',
  'b5000000-0000-4000-8000-000000000003/materials/b3000000-0000-4000-8000-000000000004/over-bytes.pdf',
  'over-bytes.pdf',
  'application/pdf',
  1,
  'pending',
  NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      'b6000000-0000-4000-8000-000000000003',
      'b3000000-0000-4000-8000-000000000004',
      'b5000000-0000-4000-8000-000000000003',
      'assignment',
      'b5000000-0000-4000-8000-000000000003/materials/b3000000-0000-4000-8000-000000000004/over-bytes.pdf',
      'over-bytes.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'Assignment materials may use at most 200 MB',
  'registration re-counts assignment bytes in its transaction'
);

INSERT INTO public.club_submission_attachments (
  assignment_id,
  submission_id,
  student_id,
  source_type,
  file_name,
  mime_type,
  file_size,
  external_url,
  google_file_id
)
SELECT
  'b5000000-0000-4000-8000-000000000004',
  NULL,
  'b3000000-0000-4000-8000-000000000005',
  'google_drive',
  'count-' || item || '.pdf',
  'application/pdf',
  1,
  'https://drive.example/submission-count-' || item,
  'submission-count-' || item
FROM generate_series(1, 10) AS item;
INSERT INTO public.coursework_upload_intents (
  id, user_id, assignment_id, target, storage_path, file_name, mime_type,
  expected_size, status, expires_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000004',
  'b3000000-0000-4000-8000-000000000005',
  'b5000000-0000-4000-8000-000000000004',
  'submission',
  'b5000000-0000-4000-8000-000000000004/submissions/b3000000-0000-4000-8000-000000000005/over-count.pdf',
  'over-count.pdf',
  'application/pdf',
  1,
  'pending',
  NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      'b6000000-0000-4000-8000-000000000004',
      'b3000000-0000-4000-8000-000000000005',
      'b5000000-0000-4000-8000-000000000004',
      'submission',
      'b5000000-0000-4000-8000-000000000004/submissions/b3000000-0000-4000-8000-000000000005/over-count.pdf',
      'over-count.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'A submission may have at most 10 attachments',
  'registration re-counts the per-student submission attachment limit'
);

INSERT INTO public.club_submission_attachments (
  assignment_id,
  submission_id,
  student_id,
  source_type,
  file_name,
  mime_type,
  file_size,
  external_url,
  google_file_id
)
SELECT
  'b5000000-0000-4000-8000-000000000005',
  NULL,
  'b3000000-0000-4000-8000-000000000005',
  'google_drive',
  'bytes-' || item || '.pdf',
  'application/pdf',
  20 * 1024 * 1024,
  'https://drive.example/submission-bytes-' || item,
  'submission-bytes-' || item
FROM generate_series(1, 5) AS item;
INSERT INTO public.coursework_upload_intents (
  id, user_id, assignment_id, target, storage_path, file_name, mime_type,
  expected_size, status, expires_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000005',
  'b3000000-0000-4000-8000-000000000005',
  'b5000000-0000-4000-8000-000000000005',
  'submission',
  'b5000000-0000-4000-8000-000000000005/submissions/b3000000-0000-4000-8000-000000000005/over-bytes.pdf',
  'over-bytes.pdf',
  'application/pdf',
  1,
  'pending',
  NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      'b6000000-0000-4000-8000-000000000005',
      'b3000000-0000-4000-8000-000000000005',
      'b5000000-0000-4000-8000-000000000005',
      'submission',
      'b5000000-0000-4000-8000-000000000005/submissions/b3000000-0000-4000-8000-000000000005/over-bytes.pdf',
      'over-bytes.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'Submission attachments may use at most 100 MB',
  'registration re-counts per-student submission bytes'
);

INSERT INTO public.club_assignment_attachments (
  id,
  assignment_id,
  uploaded_by,
  source_type,
  copy_mode,
  file_name,
  mime_type,
  file_size,
  storage_path
)
VALUES (
  'b7000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000006',
  'b3000000-0000-4000-8000-000000000004',
  'upload',
  'reference',
  'replay.pdf',
  'application/pdf',
  9,
  'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf'
);
INSERT INTO public.coursework_upload_intents (
  id,
  user_id,
  assignment_id,
  target,
  storage_path,
  file_name,
  mime_type,
  expected_size,
  status,
  attachment_id,
  expires_at,
  registered_at
)
VALUES (
  'b6000000-0000-4000-8000-000000000006',
  'b3000000-0000-4000-8000-000000000004',
  'b5000000-0000-4000-8000-000000000006',
  'assignment',
  'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf',
  'replay.pdf',
  'application/pdf',
  9,
  'registered',
  'b7000000-0000-4000-8000-000000000001',
  NOW() + INTERVAL '10 minutes',
  NOW()
);
SELECT ok(
  public.finalize_coursework_attachment_removal(
    'b7000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000006',
    'assignment',
    'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf'
  ),
  'the database finalizes a confirmed Storage removal'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.club_assignment_attachments
    WHERE id = 'b7000000-0000-4000-8000-000000000001'
  ),
  0::BIGINT,
  'the finalized attachment row is deleted'
);
SELECT results_eq(
  $$
    SELECT status, attachment_id, registered_at, storage_path
    FROM public.coursework_upload_intents
    WHERE id = 'b6000000-0000-4000-8000-000000000006'
  $$,
  $$
    VALUES (
      'rejected'::TEXT,
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf'::TEXT
    )
  $$,
  'the registered intent becomes terminal while preserving its cleanup path'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      'b6000000-0000-4000-8000-000000000006',
      'b3000000-0000-4000-8000-000000000004',
      'b5000000-0000-4000-8000-000000000006',
      'assignment',
      'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf',
      'replay.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'This private upload can no longer be registered',
  'a still-live signed upload token cannot recreate the removed attachment'
);
SELECT ok(
  public.finalize_coursework_attachment_removal(
    'b7000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000006',
    'assignment',
    'b5000000-0000-4000-8000-000000000006/materials/b3000000-0000-4000-8000-000000000004/replay.pdf'
  ),
  'attachment finalization is idempotent for a lost response retry'
);

SELECT * FROM finish();
ROLLBACK;
