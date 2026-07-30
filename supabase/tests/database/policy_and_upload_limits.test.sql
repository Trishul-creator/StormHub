BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO public.schools (
  id, name, short_name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'c0000000-0000-4000-8000-000000000001',
  'Policy Test High School',
  'Policy Test',
  'policy-test-high',
  TRUE,
  TRUE,
  ARRAY['policy-test.edu']
);

UPDATE public.school_signup_access
SET access_code = 'SH-ABCD-EF01-2345',
    rotated_at = NOW()
WHERE school_id = 'c0000000-0000-4000-8000-000000000001';

SELECT throws_ok(
  $$
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      'c1000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'bypass@policy-test.edu',
      crypt('Password123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Bypass Student","school_id":"c0000000-0000-4000-8000-000000000001","grade_level":"10","school_access_code":"SH-ABCD-EF01-2345"}',
      NOW(),
      NOW()
    )
  $$,
  'P0001',
  'Accept the current StormHub policies and confirm age 13 or older',
  'direct Auth signup cannot bypass current policy acceptance or the 13+ assurance'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'c1000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'student@policy-test.edu',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{
    "full_name":"Policy Student",
    "school_id":"c0000000-0000-4000-8000-000000000001",
    "grade_level":"10",
    "school_access_code":"SH-ABCD-EF01-2345",
    "stormhub_privacy_version":"2026-07-30",
    "stormhub_terms_version":"2026-07-30",
    "stormhub_acceptable_use_version":"2026-07-30",
    "stormhub_age_assurance":"13_or_older"
  }',
  NOW(),
  NOW()
);

SELECT is(
  (
    SELECT count(*)
    FROM public.policy_acceptances
    WHERE user_id = 'c1000000-0000-4000-8000-000000000001'
      AND privacy_version = '2026-07-30'
      AND terms_version = '2026-07-30'
      AND acceptable_use_version = '2026-07-30'
      AND age_assurance = '13_or_older'
  ),
  1::BIGINT,
  'signup metadata creates a versioned policy-acceptance record'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.policy_acceptances),
  1::BIGINT,
  'a user can read their own policy acceptance'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.policy_acceptances),
  0::BIGINT,
  'a user cannot read another account policy acceptance'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);

INSERT INTO public.clubs (
  id, school_id, name, slug, status, is_listed, visibility
) VALUES (
  'c2000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'Policy Test Club',
  'policy-test-club',
  'active',
  TRUE,
  'public'
);

INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES (
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'active',
  'president'
);

INSERT INTO public.club_assignments (
  id, club_id, author_id, title, instructions, points_possible, status, published_at
) VALUES
  (
    'c3000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Count limit',
    'Attachment limit test.',
    10,
    'published',
    NOW()
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Size limit',
    'Attachment size limit test.',
    10,
    'published',
    NOW()
  );

SELECT throws_ok(
  $$
    INSERT INTO public.club_assignment_attachments (
      assignment_id, uploaded_by, source_type, copy_mode, file_name, storage_path
    ) VALUES (
      'c3000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'upload',
      'reference',
      'missing-size.pdf',
      'count/missing-size.pdf'
    )
  $$,
  '23514',
  NULL,
  'uploaded coursework must record a positive file size'
);

INSERT INTO public.club_assignment_attachments (
  assignment_id, uploaded_by, source_type, copy_mode, file_name, mime_type,
  file_size, storage_path
)
SELECT
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'upload',
  'reference',
  'material-' || item || '.pdf',
  'application/pdf',
  1024,
  'count/material-' || item || '.pdf'
FROM generate_series(1, 20) AS item;

SELECT throws_ok(
  $$
    INSERT INTO public.club_assignment_attachments (
      assignment_id, uploaded_by, source_type, copy_mode, file_name, mime_type,
      file_size, storage_path
    ) VALUES (
      'c3000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'upload',
      'reference',
      'material-21.pdf',
      'application/pdf',
      1024,
      'count/material-21.pdf'
    )
  $$,
  'P0001',
  'An assignment may have at most 20 attached materials',
  'the database blocks assignment attachments above the count limit'
);

INSERT INTO public.club_submission_attachments (
  assignment_id, student_id, source_type, file_name, mime_type, file_size, storage_path
)
SELECT
  'c3000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'upload',
  'submission-' || item || '.pdf',
  'application/pdf',
  20 * 1024 * 1024,
  'size/submission-' || item || '.pdf'
FROM generate_series(1, 5) AS item;

SELECT throws_ok(
  $$
    INSERT INTO public.club_submission_attachments (
      assignment_id, student_id, source_type, file_name, mime_type, file_size, storage_path
    ) VALUES (
      'c3000000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000001',
      'upload',
      'submission-over-limit.pdf',
      'application/pdf',
      1,
      'size/submission-over-limit.pdf'
    )
  $$,
  'P0001',
  'Submission attachments may use at most 100 MB',
  'the database blocks submission attachments above the total-size limit'
);

INSERT INTO public.club_assignment_attachments (
  assignment_id, uploaded_by, source_type, copy_mode, file_name, mime_type,
  file_size, storage_path
) VALUES (
  'c3000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'upload',
  'reference',
  'unique-material.pdf',
  'application/pdf',
  1024,
  'unique/material.pdf'
);

SELECT throws_ok(
  $$
    INSERT INTO public.club_assignment_attachments (
      assignment_id, uploaded_by, source_type, copy_mode, file_name, mime_type,
      file_size, storage_path
    ) VALUES (
      'c3000000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000001',
      'upload',
      'reference',
      'duplicate-material.pdf',
      'application/pdf',
      1024,
      'unique/material.pdf'
    )
  $$,
  '23505',
  NULL,
  'an assignment storage object can be registered only once'
);

INSERT INTO public.club_submission_attachments (
  assignment_id, student_id, source_type, file_name, mime_type, file_size, storage_path
) VALUES (
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'upload',
  'unique-submission.pdf',
  'application/pdf',
  1024,
  'unique/submission.pdf'
);

SELECT throws_ok(
  $$
    INSERT INTO public.club_submission_attachments (
      assignment_id, student_id, source_type, file_name, mime_type, file_size, storage_path
    ) VALUES (
      'c3000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'upload',
      'duplicate-submission.pdf',
      'application/pdf',
      1024,
      'unique/submission.pdf'
    )
  $$,
  '23505',
  NULL,
  'a submission storage object can be registered only once'
);

INSERT INTO public.email_outbox (
  recipient_email, subject, body, type, dedupe_key
) VALUES (
  'student@example.test',
  'Support response',
  'Resolved',
  'feedback_response',
  'feedback-response:test:stable'
);

SELECT throws_ok(
  $$
    INSERT INTO public.email_outbox (
      recipient_email, subject, body, type, dedupe_key
    ) VALUES (
      'student@example.test',
      'Support response retry',
      'Resolved',
      'feedback_response',
      'feedback-response:test:stable'
    )
  $$,
  '23505',
  NULL,
  'a stable support reply key prevents duplicate queued email'
);

SELECT * FROM finish();
ROLLBACK;
