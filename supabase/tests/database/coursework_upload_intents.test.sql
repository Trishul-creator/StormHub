BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(28);

SELECT has_table(
  'public',
  'coursework_upload_intents',
  'coursework upload intents are durable database records'
);
SELECT has_column(
  'public',
  'coursework_upload_intents',
  'object_removed_at',
  'upload intents can record verified removal of abandoned private objects'
);
SELECT has_function(
  'public',
  'create_coursework_upload_intent',
  ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'text', 'bigint'],
  'the rate-limited upload preparation function exists'
);
SELECT has_function(
  'public',
  'register_coursework_upload_intent',
  ARRAY['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'bigint'],
  'the atomic upload registration function exists'
);

INSERT INTO public.districts (id, name, slug, is_active)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Upload Test District',
  'upload-test-district',
  TRUE
);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES
  (
    'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'Upload Test High School',
    'upload-test-high',
    TRUE,
    TRUE,
    ARRAY['upload.test']
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000001',
    'Outside Upload High School',
    'outside-upload-high',
    TRUE,
    TRUE,
    ARRAY['outside-upload.test']
  );

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'f3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'advisor@upload.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Upload Advisor"}',
    NOW(), NOW()
  ),
  (
    'f3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@upload.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Upload Student"}',
    NOW(), NOW()
  ),
  (
    'f3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'departing@upload.test', '', NOW(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Departing Upload User"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'teacher',
    school_id = 'f2000000-0000-4000-8000-000000000001'
WHERE id = 'f3000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'student',
    school_id = 'f2000000-0000-4000-8000-000000000001',
    grade_level = 10
WHERE id = 'f3000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET role = 'student',
    school_id = 'f2000000-0000-4000-8000-000000000001',
    grade_level = 11
WHERE id = 'f3000000-0000-4000-8000-000000000003';

INSERT INTO public.clubs (
  id, school_id, name, slug, status, is_listed, is_active, visibility
) VALUES (
  'f4000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'Upload Test Club',
  'upload-test-club',
  'active',
  TRUE,
  TRUE,
  'public'
);

INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES
  (
    'f4000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'active',
    'sponsor'
  ),
  (
    'f4000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000002',
    'active',
    'member'
  );

INSERT INTO public.club_assignments (
  id, club_id, author_id, title, instructions, points_possible, status, published_at
) VALUES (
  'f5000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'Upload Test Assignment',
  'Upload a private file.',
  10,
  'published',
  NOW()
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT count(*) FROM public.coursework_upload_intents$$,
  '42501',
  NULL,
  'authenticated clients cannot read upload authorization records'
);
SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'f3000000-0000-4000-8000-000000000002',
      'f5000000-0000-4000-8000-000000000001',
      'submission',
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/blocked.pdf',
      'blocked.pdf',
      'application/pdf',
      9
    )
  $$,
  '42501',
  NULL,
  'authenticated clients cannot create an intent without the authorized server'
);

RESET ROLE;
-- Changing the database role does not clear the request JWT. Remove the
-- authenticated student's subject before trusted service-role fixture updates.
SELECT set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  TRUE
);
SET LOCAL ROLE service_role;

CREATE TEMP TABLE upload_test_ids (
  name TEXT PRIMARY KEY,
  intent_id UUID,
  attachment_id UUID
);

INSERT INTO upload_test_ids (name, intent_id)
VALUES (
  'advisor',
  public.create_coursework_upload_intent(
    'f3000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    'assignment',
    'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf',
    'advisor.pdf',
    'application/pdf',
    9
  )
);

SELECT is(
  (
    SELECT target
    FROM public.coursework_upload_intents
    WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor')
  ),
  'assignment',
  'an intent records its exact upload target'
);
SELECT is(
  (
    SELECT expected_size
    FROM public.coursework_upload_intents
    WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor')
  ),
  9::BIGINT,
  'an intent records its exact expected byte size'
);

SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf',
      'renamed.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'Private upload metadata does not match the prepared intent',
  'registration rejects substituted metadata'
);

UPDATE upload_test_ids
SET attachment_id = public.register_coursework_upload_intent(
  intent_id,
  'f3000000-0000-4000-8000-000000000001',
  'f5000000-0000-4000-8000-000000000001',
  'assignment',
  'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf',
  'advisor.pdf',
  'application/pdf',
  9
)
WHERE name = 'advisor';

SELECT isnt(
  (SELECT attachment_id FROM upload_test_ids WHERE name = 'advisor'),
  NULL::UUID,
  'an exact unexpired intent registers an attachment'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.club_assignment_attachments
    WHERE storage_path =
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf'
  ),
  1::BIGINT,
  'atomic registration creates one assignment attachment row'
);
SELECT is(
  (
    SELECT status
    FROM public.coursework_upload_intents
    WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor')
  ),
  'registered',
  'atomic registration consumes the intent'
);
SELECT is(
  public.register_coursework_upload_intent(
    (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor'),
    'f3000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    'assignment',
    'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf',
    'advisor.pdf',
    'application/pdf',
    9
  ),
  (SELECT attachment_id FROM upload_test_ids WHERE name = 'advisor'),
  'an exact retry returns the same attachment without duplicating it'
);

SELECT throws_ok(
  $$
    UPDATE public.coursework_upload_intents
    SET object_removed_at = NOW()
    WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor')
  $$,
  '23514',
  NULL,
  'a registered attachment intent cannot be marked as an abandoned object'
);

DELETE FROM public.club_assignment_attachments
WHERE id = (SELECT attachment_id FROM upload_test_ids WHERE name = 'advisor');

SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'advisor'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/advisor.pdf',
      'advisor.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'Registered coursework attachment no longer exists',
  'a registered retry fails when its attachment row was removed'
);

INSERT INTO upload_test_ids (name, intent_id)
VALUES (
  'expired',
  public.create_coursework_upload_intent(
    'f3000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    'assignment',
    'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/expired.pdf',
    'expired.pdf',
    'application/pdf',
    9
  )
);
UPDATE public.coursework_upload_intents
SET expires_at = NOW() - INTERVAL '1 minute'
WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'expired');

SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'expired'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/expired.pdf',
      'expired.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'This private upload expired. Upload the file again',
  'registration rejects expired intents'
);

INSERT INTO upload_test_ids (name, intent_id)
VALUES (
  'suspended',
  public.create_coursework_upload_intent(
    'f3000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    'assignment',
    'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/suspended.pdf',
    'suspended.pdf',
    'application/pdf',
    9
  )
);
UPDATE public.profiles
SET account_status = 'suspended'
WHERE id = 'f3000000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'suspended'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/suspended.pdf',
      'suspended.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'Coursework upload access is no longer active',
  'registration re-checks account status after intent issuance'
);
UPDATE public.profiles
SET account_status = 'active'
WHERE id = 'f3000000-0000-4000-8000-000000000001';
UPDATE public.coursework_upload_intents
SET status = 'rejected', rejection_reason = 'Account access revoked before registration'
WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'suspended');

SELECT throws_ok(
  $$
    UPDATE public.coursework_upload_intents
    SET object_removed_at = NOW()
    WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'suspended')
  $$,
  '23514',
  NULL,
  'abandoned object removal cannot be marked before the signed-token grace period'
);

INSERT INTO upload_test_ids (name, intent_id)
VALUES (
  'tenant-disabled',
  public.create_coursework_upload_intent(
    'f3000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    'assignment',
    'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/tenant-disabled.pdf',
    'tenant-disabled.pdf',
    'application/pdf',
    9
  )
);
UPDATE public.schools
SET is_active = FALSE
WHERE id = 'f2000000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'tenant-disabled'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/tenant-disabled.pdf',
      'tenant-disabled.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'Coursework upload access is no longer active',
  'registration re-checks tenant access after intent issuance'
);
UPDATE public.schools
SET is_active = TRUE
WHERE id = 'f2000000-0000-4000-8000-000000000001';
UPDATE public.coursework_upload_intents
SET status = 'rejected', rejection_reason = 'Tenant access revoked before registration'
WHERE id = (SELECT intent_id FROM upload_test_ids WHERE name = 'tenant-disabled');

UPDATE public.profiles
SET school_id = 'f2000000-0000-4000-8000-000000000002'
WHERE id = 'f3000000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'f3000000-0000-4000-8000-000000000002',
      'f5000000-0000-4000-8000-000000000001',
      'submission',
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/cross-school.pdf',
      'cross-school.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'An active student club membership is required',
  'a corrupt cross-school membership cannot authorize a submission upload'
);
UPDATE public.profiles
SET school_id = 'f2000000-0000-4000-8000-000000000001'
WHERE id = 'f3000000-0000-4000-8000-000000000002';

INSERT INTO upload_test_ids (name, intent_id)
VALUES (
  'student',
  public.create_coursework_upload_intent(
    'f3000000-0000-4000-8000-000000000002',
    'f5000000-0000-4000-8000-000000000001',
    'submission',
    'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/student.pdf',
    'student.pdf',
    'application/pdf',
    9
  )
);
UPDATE upload_test_ids
SET attachment_id = public.register_coursework_upload_intent(
  intent_id,
  'f3000000-0000-4000-8000-000000000002',
  'f5000000-0000-4000-8000-000000000001',
  'submission',
  'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/student.pdf',
  'student.pdf',
  'application/pdf',
  9
)
WHERE name = 'student';

SELECT isnt(
  (SELECT attachment_id FROM upload_test_ids WHERE name = 'student'),
  NULL::UUID,
  'a member can consume a submission upload intent'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.club_submission_attachments
    WHERE student_id = 'f3000000-0000-4000-8000-000000000002'
      AND storage_path =
        'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/student.pdf'
  ),
  1::BIGINT,
  'student intent registration creates one private submission attachment'
);
SELECT throws_ok(
  $$
    SELECT public.register_coursework_upload_intent(
      (SELECT intent_id FROM upload_test_ids WHERE name = 'student'),
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'submission',
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/student.pdf',
      'student.pdf',
      'application/pdf',
      9
    )
  $$,
  'P0001',
  'Private upload metadata does not match the prepared intent',
  'another user cannot consume an upload intent'
);

-- Every signed token reserves the full bucket maximum. Five one-byte
-- declarations therefore fill the 100 MB pending-token quota.
SELECT public.create_coursework_upload_intent(
  'f3000000-0000-4000-8000-000000000001',
  'f5000000-0000-4000-8000-000000000001',
  'assignment',
  'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/count-' || item || '.pdf',
  'count-' || item || '.pdf',
  'application/pdf',
  1
)
FROM generate_series(1, 5) AS item;

SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/count-6.pdf',
      'count-6.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'Pending private uploads may use at most 100 MB',
  'small declared sizes cannot bypass conservative pending-token capacity'
);

UPDATE public.coursework_upload_intents
SET status = 'rejected', rejection_reason = 'Test cleanup'
WHERE user_id = 'f3000000-0000-4000-8000-000000000001'
  AND status = 'pending';

-- Five maximum-size pending uploads equal the 100 MB pending-byte quota.
SELECT public.create_coursework_upload_intent(
  'f3000000-0000-4000-8000-000000000002',
  'f5000000-0000-4000-8000-000000000001',
  'submission',
  'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/bytes-' || item || '.pdf',
  'bytes-' || item || '.pdf',
  'application/pdf',
  20 * 1024 * 1024
)
FROM generate_series(1, 5) AS item;

SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'f3000000-0000-4000-8000-000000000002',
      'f5000000-0000-4000-8000-000000000001',
      'submission',
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000002/bytes-over.pdf',
      'bytes-over.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'Pending private uploads may use at most 100 MB',
  'a durable active-intent byte quota limits orphan upload capacity'
);

UPDATE public.coursework_upload_intents
SET status = 'rejected', rejection_reason = 'Test cleanup'
WHERE user_id = 'f3000000-0000-4000-8000-000000000002'
  AND status = 'pending';

-- Terminal intents still represent recently issued signed tokens. Bring this
-- actor to twelve recent tokens (240 MB reserved), then reject a thirteenth
-- one-byte declaration under the 250 MB rolling cap.
INSERT INTO public.coursework_upload_intents (
  user_id, assignment_id, target, storage_path, file_name, mime_type,
  expected_size, status, rejection_reason, expires_at
)
SELECT
  'f3000000-0000-4000-8000-000000000001',
  'f5000000-0000-4000-8000-000000000001',
  'assignment',
  'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/rate-' || item || '.pdf',
  'rate-' || item || '.pdf',
  'application/pdf',
  1,
  'rejected',
  'Rolling rate test',
  NOW() + INTERVAL '10 minutes'
FROM generate_series(
  1,
  12 - (
    SELECT COUNT(*)::INTEGER
    FROM public.coursework_upload_intents
    WHERE user_id = 'f3000000-0000-4000-8000-000000000001'
      AND created_at > NOW() - INTERVAL '10 minutes'
  )
) AS item;

SELECT throws_ok(
  $$
    SELECT public.create_coursework_upload_intent(
      'f3000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'assignment',
      'f5000000-0000-4000-8000-000000000001/materials/f3000000-0000-4000-8000-000000000001/rate-over.pdf',
      'rate-over.pdf',
      'application/pdf',
      1
    )
  $$,
  'P0001',
  'Private upload preparation limit reached. Wait a few minutes and try again',
  'small declared sizes cannot bypass conservative recent-token capacity'
);

INSERT INTO public.coursework_upload_intents (
  user_id,
  assignment_id,
  target,
  storage_path,
  file_name,
  mime_type,
  expected_size,
  status,
  rejection_reason,
  expires_at,
  object_removed_at
) VALUES (
  'f3000000-0000-4000-8000-000000000003',
  'f5000000-0000-4000-8000-000000000001',
  'submission',
  'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000003/departing.pdf',
  'departing.pdf',
  'application/pdf',
  9,
  'rejected',
  'Test terminal upload cleanup',
  NOW() - INTERVAL '1 day',
  NOW()
);

DELETE FROM public.profiles
WHERE id = 'f3000000-0000-4000-8000-000000000003';

SELECT results_eq(
  $$
    SELECT user_id, storage_path
    FROM public.coursework_upload_intents
    WHERE storage_path =
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000003/departing.pdf'
  $$,
  $$
    VALUES (
      NULL::UUID,
      'f5000000-0000-4000-8000-000000000001/submissions/f3000000-0000-4000-8000-000000000003/departing.pdf'::TEXT
    )
  $$,
  'account deletion preserves a terminal intent path for retention cleanup'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.coursework_upload_intents
    WHERE status = 'registered'
      AND attachment_id IS NOT NULL
  ),
  2::BIGINT,
  'registered intents retain a short audit link to their created attachment'
);

SELECT * FROM finish();
ROLLBACK;
