BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

SELECT has_column(
  'public',
  'school_settings',
  'student_content_requires_staff_approval',
  'schools can opt into mandatory staff review for student content'
);
SELECT has_column(
  'public',
  'districts',
  'description',
  'districts support a concise descriptive summary'
);
SELECT has_function(
  'public',
  'club_requires_staff_content_approval',
  ARRAY['uuid'],
  'the moderation setting is resolved through a stable helper'
);
SELECT is(
  public.club_requires_staff_content_approval('c0000001-0000-4000-8000-000000000003'),
  FALSE,
  'existing schools retain President publishing by default'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'e1c10000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'moderation-president@example.test', '', NOW(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Moderation President"}',
  NOW(), NOW()
);
UPDATE public.profiles
SET school_id = 'a0000000-0000-4000-8000-000000000001', role = 'student'
WHERE id = 'e1c10000-0000-4000-8000-000000000001';
INSERT INTO public.club_memberships (club_id, user_id, status, role)
VALUES (
  'c0000001-0000-4000-8000-000000000003',
  'e1c10000-0000-4000-8000-000000000001',
  'active',
  'president'
);
INSERT INTO public.club_announcements (
  id, club_id, author_id, title, body, visibility, status
) VALUES (
  'e1c10000-0000-4000-8000-000000000002',
  'c0000001-0000-4000-8000-000000000003',
  'e1c10000-0000-4000-8000-000000000001',
  'Moderated student draft',
  'Fictional database authorization test.',
  'members',
  'draft'
);

UPDATE public.school_settings
SET student_content_requires_staff_approval = TRUE
WHERE school_id = 'a0000000-0000-4000-8000-000000000001';
SELECT ok(
  public.club_requires_staff_content_approval('c0000001-0000-4000-8000-000000000003'),
  'the opted-in school requires staff review'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e1c10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    UPDATE public.club_announcements
    SET status = 'approved', published_at = NOW()
    WHERE id = 'e1c10000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'This content requires approval from an authorized club Advisor or administrator',
  'a student President cannot bypass required staff review'
);
SELECT is(
  (SELECT status FROM public.club_announcements WHERE id = 'e1c10000-0000-4000-8000-000000000002'),
  'draft',
  'the bypass attempt leaves the announcement private'
);

RESET ROLE;
UPDATE public.school_settings
SET student_content_requires_staff_approval = FALSE
WHERE school_id = 'a0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$
    UPDATE public.club_announcements
    SET status = 'approved', published_at = NOW()
    WHERE id = 'e1c10000-0000-4000-8000-000000000002'
  $$,
  'student President publishing remains available for schools that do not opt in'
);

SELECT * FROM finish();
ROLLBACK;
