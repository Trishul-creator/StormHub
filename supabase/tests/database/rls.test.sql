BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(67);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'coursework-private'),
  FALSE,
  'coursework uploads use a private storage bucket'
);

UPDATE public.schools
SET allowed_email_domains = ARRAY['school-a.edu']
WHERE id = 'a0000000-0000-4000-8000-000000000001';

INSERT INTO public.schools (
  id, name, short_name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'b0000000-0000-4000-8000-000000000002',
  'School B',
  'School B',
  'school-b',
  TRUE,
  TRUE,
  ARRAY['*']
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'student-a@school-a.edu', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student A","school_id":"a0000000-0000-4000-8000-000000000001","grade_level":"10"}',
    NOW(), NOW()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'student-b@school-b.edu', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student B","school_id":"b0000000-0000-4000-8000-000000000002","grade_level":"11"}',
    NOW(), NOW()
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'teacher-a@school-a.edu', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Teacher A","school_id":"a0000000-0000-4000-8000-000000000001"}',
    NOW(), NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin-a@school-a.edu', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin A","school_id":"a0000000-0000-4000-8000-000000000001"}',
    NOW(), NOW()
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'super@school-a.edu', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin","school_id":"a0000000-0000-4000-8000-000000000001"}',
    NOW(), NOW()
  );

UPDATE public.profiles SET role = 'teacher'
WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'admin'
WHERE id = '30000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'super_admin', school_id = NULL
WHERE id = '40000000-0000-4000-8000-000000000001';

INSERT INTO public.clubs (
  id, school_id, name, slug, status, is_listed, visibility
) VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'School A Club', 'school-a-club', 'active', TRUE, 'public'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    'School B Club', 'school-b-club', 'active', TRUE, 'public'
  );

INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'active',
  'sponsor'
);

INSERT INTO public.events (
  id, school_id, club_id, title, starts_at, status, visibility
) VALUES
  (
    'a2000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'School A Event', NOW() + INTERVAL '1 day', 'approved', 'public'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'School B Event', NOW() + INTERVAL '1 day', 'approved', 'public'
  );

SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM public.clubs), 2::BIGINT, 'anonymous users can read listed public clubs');
SELECT is((SELECT count(*) FROM public.profiles), 0::BIGINT, 'anonymous users cannot read profiles');
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles), 1::BIGINT, 'students can read only their own profile');
SELECT is((SELECT count(*) FROM public.club_memberships), 0::BIGINT, 'students cannot read another user membership');
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Users cannot change protected account fields',
  'students cannot elevate their own role'
);
SELECT lives_ok(
  $$UPDATE public.profiles SET full_name = 'Updated Student A' WHERE id = '10000000-0000-4000-8000-000000000001'$$,
  'students can update unprotected profile fields'
);
SELECT lives_ok(
  $$INSERT INTO public.account_deletion_requests (user_id, school_id, reason) VALUES ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'No longer needed')$$,
  'students can request deletion for their own account'
);
SELECT throws_ok(
  $$INSERT INTO public.account_deletion_requests (user_id, school_id, reason) VALUES ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Bypass')$$,
  '42501',
  NULL,
  'students cannot submit a deletion request for another account'
);
SELECT throws_ok(
  $$INSERT INTO public.feedback (school_id, user_id, message) VALUES ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Bypass')$$,
  '42501',
  NULL,
  'authenticated users cannot bypass the protected feedback endpoint'
);
SELECT throws_ok(
  $$INSERT INTO public.interest_forms (school_id, full_name, email) VALUES ('a0000000-0000-4000-8000-000000000001', 'Bypass', 'bypass@school-a.edu')$$,
  '42501',
  NULL,
  'authenticated users cannot directly insert public interest forms'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.club_memberships), 1::BIGINT, 'teacher sponsors can read their managed roster');
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '10000000-0000-4000-8000-000000000001'),
  0::BIGINT,
  'teacher sponsors cannot browse students outside roster membership'
);
SELECT lives_ok(
  $$SELECT public.manage_club_roster_member('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'officer', FALSE)$$,
  'teacher sponsors can manage students in their club'
);
SELECT lives_ok(
  $$INSERT INTO public.club_assignments (
      id, club_id, author_id, title, instructions, points_possible, status, published_at
    ) VALUES (
      'a3000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'Practice reflection',
      'Submit a short reflection.',
      20,
      'published',
      NOW()
    )$$,
  'teacher sponsors can create assignments for their club'
);
SELECT throws_ok(
  $$INSERT INTO public.club_assignment_attachments (
      assignment_id, uploaded_by, source_type, copy_mode, file_name, storage_path
    ) VALUES (
      'a3000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'upload',
      'reference',
      'bypass.pdf',
      'bypass/path.pdf'
    )$$,
  '42501',
  NULL,
  'coursework managers cannot bypass server-authorized attachment registration'
);
SELECT is(
  (SELECT count(*) FROM public.get_club_member_directory('a1000000-0000-4000-8000-000000000001')),
  2::BIGINT,
  'teacher sponsors can view the limited club directory'
);
SELECT throws_ok(
  $$SELECT public.manage_club_roster_member('b1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'member', FALSE)$$,
  'P0001',
  'Teacher sponsor or administrator access required',
  'teacher sponsors cannot manage another school roster'
);
SELECT lives_ok(
  $$INSERT INTO public.account_deletion_requests (user_id, school_id, reason) VALUES ('20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Teacher self-service request')$$,
  'teachers can request deletion for their own account'
);
RESET ROLE;
DELETE FROM public.account_deletion_requests
WHERE user_id = '20000000-0000-4000-8000-000000000001';

INSERT INTO public.club_assignments (
  id, club_id, author_id, title, instructions, points_possible,
  submission_mode, status, published_at
) VALUES (
  'a3000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Attend practice',
  'Mark this complete after practice.',
  5,
  'completion',
  'published',
  NOW()
);

INSERT INTO public.club_assignment_attachments (
  id, assignment_id, uploaded_by, source_type, copy_mode, file_name,
  mime_type, file_size, storage_path, external_url, google_file_id
) VALUES
  (
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'upload',
    'reference',
    'practice.pdf',
    'application/pdf',
    1024,
    'a3000000-0000-4000-8000-000000000001/materials/teacher/practice.pdf',
    NULL,
    NULL
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'google_drive',
    'student_copy',
    'Reflection template',
    'application/vnd.google-apps.document',
    NULL,
    NULL,
    'https://docs.google.com/document/d/template',
    'google-template'
  );

INSERT INTO public.club_submission_attachments (
  id, assignment_id, submission_id, student_id, source_type, file_name,
  mime_type, file_size, storage_path
) VALUES (
  'a5000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  NULL,
  '10000000-0000-4000-8000-000000000001',
  'upload',
  'student-work.pdf',
  'application/pdf',
  2048,
  'a3000000-0000-4000-8000-000000000001/submissions/student/student-work.pdf'
);

INSERT INTO public.club_assignment_student_copies (
  assignment_id, assignment_attachment_id, student_id, google_file_id, file_name, web_url
) VALUES (
  'a3000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'google-student-copy',
  'Reflection template - Student A',
  'https://docs.google.com/document/d/student-copy'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.club_assignments),
  2::BIGINT,
  'active club members can read published assignments for their club'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_attachments),
  2::BIGINT,
  'active club members can read assignment materials for their club'
);
SELECT is(
  (SELECT count(*) FROM public.club_submission_attachments),
  1::BIGINT,
  'students can read only their own private submission attachments'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_student_copies),
  1::BIGINT,
  'students can read only their own Google Drive copies'
);
SELECT throws_ok(
  $$INSERT INTO public.club_submission_attachments (
      assignment_id, student_id, source_type, file_name, storage_path
    ) VALUES (
      'a3000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'upload',
      'bypass.pdf',
      'bypass/submission.pdf'
    )$$,
  '42501',
  NULL,
  'students cannot bypass server-authorized private attachment registration'
);
SELECT lives_ok(
  $$SELECT public.submit_club_assignment(
      'a3000000-0000-4000-8000-000000000001',
      'My reflection',
      'https://example.com/student-work'
    )$$,
  'student members can submit their own assignment work'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_submissions),
  1::BIGINT,
  'students can read their own submission'
);
SELECT lives_ok(
  $$SELECT public.submit_club_assignment(
      'a3000000-0000-4000-8000-000000000002',
      NULL,
      NULL
    )$$,
  'students can mark completion-only assignments complete without an attachment'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_submissions),
  2::BIGINT,
  'completion-only work is recorded as a private submission'
);
SELECT is(
  (SELECT count(*) FROM public.get_club_member_directory('a1000000-0000-4000-8000-000000000001')),
  2::BIGINT,
  'student members can view names and roles in their own club directory'
);
SELECT throws_ok(
  $$UPDATE public.club_assignment_submissions SET grade_points = 20$$,
  '42501',
  NULL,
  'students cannot directly modify assignment grades'
);
SELECT throws_ok(
  $$INSERT INTO public.club_assignments (
      club_id, author_id, title, instructions, points_possible, status
    ) VALUES (
      'a1000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Unauthorized assignment',
      'Bypass',
      100,
      'published'
    )$$,
  '42501',
  NULL,
  'student officers cannot create or grade coursework'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.club_assignments),
  0::BIGINT,
  'students cannot read assignments for clubs they did not join'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_attachments),
  0::BIGINT,
  'students cannot read assignment files for clubs they did not join'
);
SELECT is(
  (SELECT count(*) FROM public.club_submission_attachments),
  0::BIGINT,
  'students cannot read another student private attachments'
);
SELECT is(
  (SELECT count(*) FROM public.club_assignment_student_copies),
  0::BIGINT,
  'students cannot read another student Google Drive copies'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_club_member_directory('a1000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Club membership required',
  'students cannot view another club directory'
);
SELECT throws_ok(
  $$SELECT public.submit_club_assignment(
      'a3000000-0000-4000-8000-000000000001',
      'Cross-school attempt',
      NULL
    )$$,
  'P0001',
  'An active student club membership is required',
  'students cannot submit work to another club'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.club_assignment_submissions),
  2::BIGINT,
  'teacher sponsors can review submissions for their club'
);
SELECT is(
  (SELECT count(*) FROM public.club_submission_attachments),
  1::BIGINT,
  'teacher sponsors can review private attachments for their club'
);
SELECT lives_ok(
  $$SELECT public.grade_club_assignment_submission(
      (SELECT id FROM public.club_assignment_submissions
        WHERE assignment_id = 'a3000000-0000-4000-8000-000000000001'),
      18,
      'Clear reasoning and a strong reflection.'
    )$$,
  'teacher sponsors can return a grade and private feedback'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT grade_points FROM public.club_assignment_submissions
    WHERE assignment_id = 'a3000000-0000-4000-8000-000000000001'),
  18::NUMERIC,
  'students can see their returned grade'
);
SELECT is(
  (SELECT status FROM public.club_assignment_submissions
    WHERE assignment_id = 'a3000000-0000-4000-8000-000000000001'),
  'returned',
  'graded work is returned only to its student'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT ok(public.has_admin_mfa(), 'confirmed-email admin sessions pass the retired MFA compatibility gate');
SELECT is((SELECT count(*) FROM public.profiles), 3::BIGINT, 'confirmed-email school admins can read users in their school only');
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE school_id = 'b0000000-0000-4000-8000-000000000002'),
  0::BIGINT,
  'confirmed-email school admins still cannot read another school profiles'
);
SELECT is((SELECT count(*) FROM public.account_deletion_requests), 1::BIGINT, 'confirmed-email school admins can read same-school deletion requests');
SELECT lives_ok(
  $$SELECT public.admin_set_account_status('10000000-0000-4000-8000-000000000001', 'suspended')$$,
  'confirmed-email school admins can use authorized account RPCs'
);
SELECT lives_ok(
  $$SELECT public.set_school_signup_domains('a0000000-0000-4000-8000-000000000001', ARRAY['school-a.edu'])$$,
  'school admins can update accepted email domains for their own school'
);
SELECT lives_ok(
  $$INSERT INTO public.account_deletion_requests (user_id, school_id, reason) VALUES ('30000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Admin self-service request')$$,
  'school admins can request deletion for their own account'
);
SELECT throws_ok(
  $$SELECT public.set_school_signup_domains('b0000000-0000-4000-8000-000000000002', ARRAY['example.com'])$$,
  'P0001',
  'School administrators can only update their own school',
  'school admins cannot update another school signup domains'
);
RESET ROLE;
DELETE FROM public.account_deletion_requests
WHERE user_id = '30000000-0000-4000-8000-000000000001';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles), 3::BIGINT, 'higher-assurance school admin sessions retain same-school access');
SELECT is((SELECT count(*) FROM public.account_deletion_requests), 1::BIGINT, 'higher-assurance school admin sessions retain deletion-request access');
SELECT lives_ok(
  $$UPDATE public.account_deletion_requests SET status = 'rejected', reviewed_by = '30000000-0000-4000-8000-000000000001', reviewed_at = NOW() WHERE user_id = '10000000-0000-4000-8000-000000000001'$$,
  'school admins can review same-school deletion requests'
);
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE school_id = 'b0000000-0000-4000-8000-000000000002'),
  0::BIGINT,
  'school admins cannot read another school profiles'
);
SELECT throws_ok(
  $$SELECT public.admin_set_account_status('10000000-0000-4000-8000-000000000002', 'suspended')$$,
  'P0001',
  'Only a super admin can modify this account',
  'school admins cannot suspend another school user'
);
SELECT lives_ok(
  $$SELECT public.admin_set_account_status('10000000-0000-4000-8000-000000000001', 'suspended')$$,
  'school admins can suspend a same-school student'
);
SELECT ok((SELECT count(*) > 0 FROM public.admin_audit_log), 'privileged changes create audit records');
SELECT throws_ok(
  $$DELETE FROM public.admin_audit_log$$,
  '42501',
  NULL,
  'audit records are immutable to admins'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.clubs), 0::BIGINT, 'suspended users cannot read application content');
SELECT throws_ok(
  $$INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES ('a2000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'going')$$,
  '42501',
  NULL,
  'suspended users cannot create application data'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles), 5::BIGINT, 'confirmed-email super admins can read profiles across schools');
SELECT lives_ok(
  $$INSERT INTO public.account_deletion_requests (user_id, school_id, reason) VALUES ('40000000-0000-4000-8000-000000000001', NULL, 'Super admin self-service request')$$,
  'super admins can request deletion for their own account'
);
RESET ROLE;
DELETE FROM public.account_deletion_requests
WHERE user_id = '40000000-0000-4000-8000-000000000001';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.profiles), 5::BIGINT, 'higher-assurance super admin sessions retain platform-wide access');
SELECT lives_ok(
  $$SELECT public.admin_set_account_status('10000000-0000-4000-8000-000000000002', 'suspended')$$,
  'super admins can manage users across schools'
);
SELECT lives_ok(
  $$SELECT public.set_school_signup_domains('b0000000-0000-4000-8000-000000000002', ARRAY['*'])$$,
  'super admins can update accepted email domains for any school'
);
RESET ROLE;

SELECT throws_ok(
  $$
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '50000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'outsider@example.com', crypt('Password123!', gen_salt('bf')),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Outsider","school_id":"a0000000-0000-4000-8000-000000000001"}',
      NOW(), NOW()
    )
  $$,
  'P0001',
  'Use an approved school email address',
  'the auth trigger rejects direct signups from unapproved domains'
);

SELECT lives_ok(
  $$
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '50000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'outside-domain@example.com', crypt('Password123!', gen_salt('bf')),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Wildcard Student","school_id":"b0000000-0000-4000-8000-000000000002"}',
      NOW(), NOW()
    )
  $$,
  'a school configured with * accepts any verified email domain'
);

SELECT * FROM finish();
ROLLBACK;
