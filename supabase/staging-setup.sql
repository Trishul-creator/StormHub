-- StormHub staging setup.
-- Run this ONLY on the StormHub Staging Supabase project after the base schema,
-- policies, and patch files listed in docs/DEPLOYMENT.md.
--
-- This is intentionally generic. E2E should use school1/school2 instead of
-- real school names.
--
-- Idempotent. Safe to rerun on staging. Not intended for production.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles ALTER COLUMN school_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.school_settings (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  announcements_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  events_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  resources_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  opportunities_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  volunteering_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  workshops_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_sending_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_settings_read" ON public.school_settings;
CREATE POLICY "school_settings_read" ON public.school_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "school_settings_super_admin_manage" ON public.school_settings;
CREATE POLICY "school_settings_super_admin_manage" ON public.school_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

INSERT INTO public.schools (
  id, name, short_name, slug, city, state, mascot, is_active, is_public, updated_at
) VALUES
(
  'b0000000-0000-4000-8000-000000000001',
  'School 1',
  'School 1',
  'school1',
  'Test City',
  'TS',
  'One',
  TRUE,
  TRUE,
  NOW()
),
(
  'b0000000-0000-4000-8000-000000000002',
  'School 2',
  'School 2',
  'school2',
  'Test City',
  'TS',
  'Two',
  TRUE,
  TRUE,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  mascot = EXCLUDED.mascot,
  is_active = TRUE,
  is_public = TRUE,
  updated_at = NOW();

INSERT INTO public.school_settings (
  school_id,
  announcements_enabled,
  events_enabled,
  resources_enabled,
  opportunities_enabled,
  volunteering_enabled,
  workshops_enabled,
  email_sending_enabled
)
SELECT id, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE
FROM public.schools
WHERE slug IN ('school1', 'school2')
ON CONFLICT (school_id) DO UPDATE SET
  announcements_enabled = TRUE,
  events_enabled = TRUE,
  resources_enabled = TRUE,
  opportunities_enabled = TRUE,
  volunteering_enabled = FALSE,
  workshops_enabled = FALSE,
  email_sending_enabled = TRUE,
  updated_at = NOW();

-- Hide legacy/sample content if older seed files were accidentally run.
UPDATE public.club_announcements SET status = 'archived', updated_at = NOW()
WHERE author_id IS NULL AND status <> 'archived';

UPDATE public.club_resources SET status = 'archived', updated_at = NOW()
WHERE author_id IS NULL AND status <> 'archived';

UPDATE public.workshops SET status = 'archived', updated_at = NOW()
WHERE status <> 'archived';

UPDATE public.opportunities SET status = 'archived', updated_at = NOW()
WHERE slug IN (
  'volunteer-hours',
  'workshop-host-app',
  'peer-tutoring-chemistry',
  'peer-tutoring-algebra',
  'youth-leadership-conference'
);

WITH school1 AS (
  SELECT id AS school_id FROM public.schools WHERE slug = 'school1'
),
clubs_to_seed AS (
  SELECT * FROM (
    VALUES
      (
        'Science Bowl',
        'school1-science-bowl',
        'Competitive buzzer-based science and math team.',
        'Science Bowl is for students who enjoy fast-paced science and math questions. Members practice biology, chemistry, physics, earth science, astronomy, energy, and math, then prepare for regional competition.',
        'STEM',
        ARRAY['science','competition','stem']
      ),
      (
        'Math Club',
        'school1-math-club',
        'Contest math, problem solving, and math enrichment.',
        'Math Club helps students explore mathematical problem solving beyond the classroom, including AMC-style problems, student-led lessons, and contest preparation.',
        'STEM',
        ARRAY['math','competition','stem']
      ),
      (
        'Robotics Club',
        'school1-robotics-club',
        'Hands-on robot design, building, programming, and competition.',
        'Robotics Club gives students experience with engineering design, coding, mechanical systems, CAD, strategy, teamwork, and competition preparation.',
        'STEM',
        ARRAY['robotics','engineering','stem']
      )
  ) AS club(name, slug, short_description, long_description, category, tags)
)
INSERT INTO public.clubs (
  school_id,
  name,
  slug,
  short_description,
  long_description,
  category,
  tags,
  sponsor_name,
  sponsor_email,
  meeting_time,
  meeting_location,
  join_instructions,
  status,
  is_listed,
  is_featured,
  is_active,
  visibility
)
SELECT
  school1.school_id,
  clubs_to_seed.name,
  clubs_to_seed.slug,
  clubs_to_seed.short_description,
  clubs_to_seed.long_description,
  clubs_to_seed.category,
  clubs_to_seed.tags,
  NULL,
  NULL,
  NULL,
  NULL,
  'Join to receive updates when this staging club has meetings or announcements.',
  'interest_open',
  TRUE,
  TRUE,
  TRUE,
  'public'
FROM school1
CROSS JOIN clubs_to_seed
ON CONFLICT (slug) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  sponsor_name = NULL,
  sponsor_email = NULL,
  meeting_time = NULL,
  meeting_location = NULL,
  join_instructions = EXCLUDED.join_instructions,
  status = 'interest_open',
  is_listed = TRUE,
  is_featured = TRUE,
  is_active = TRUE,
  visibility = 'public',
  updated_at = NOW();

-- School 2 intentionally starts empty for cross-school empty-state tests.
UPDATE public.clubs
SET status = 'draft',
    is_listed = FALSE,
    is_featured = FALSE,
    visibility = 'unlisted',
    updated_at = NOW()
WHERE school_id = 'b0000000-0000-4000-8000-000000000002'::UUID;

WITH school1_clubs AS (
  SELECT c.school_id, c.id AS club_id, c.name, c.slug, c.tags
  FROM public.clubs c
  WHERE c.slug IN ('school1-science-bowl', 'school1-math-club', 'school1-robotics-club')
)
INSERT INTO public.opportunities (
  school_id,
  club_id,
  title,
  slug,
  summary,
  description,
  category,
  tags,
  eligibility,
  grade_min,
  grade_max,
  deadline,
  action_label,
  status,
  visibility
)
SELECT
  school_id,
  club_id,
  CASE
    WHEN name = 'Science Bowl' THEN 'Join Science Bowl'
    WHEN name = 'Robotics Club' THEN 'Join Robotics Club'
    ELSE 'Math Club Contest Interest'
  END,
  slug || '-interest',
  CASE
    WHEN name = 'Science Bowl' THEN 'Register interest in Science Bowl practices and competition updates.'
    WHEN name = 'Robotics Club' THEN 'Register interest in Robotics build sessions and team announcements.'
    ELSE 'Get updates for Math Club contest prep and competition signups.'
  END,
  CASE
    WHEN name = 'Science Bowl' THEN 'Submit interest so Science Bowl leaders and the sponsor can follow up with meeting details.'
    WHEN name = 'Robotics Club' THEN 'Submit interest so Robotics leaders and the sponsor can share next steps.'
    ELSE 'Submit interest so Math Club leaders can send practice and contest information.'
  END,
  CASE WHEN name = 'Math Club' THEN 'Competition' ELSE 'Interest Form' END,
  tags,
  'Open to high school students',
  9,
  12,
  NOW() + INTERVAL '45 days',
  'Sign Up',
  'approved',
  'public'
FROM school1_clubs
ON CONFLICT (slug) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  club_id = EXCLUDED.club_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  eligibility = EXCLUDED.eligibility,
  grade_min = EXCLUDED.grade_min,
  grade_max = EXCLUDED.grade_max,
  deadline = EXCLUDED.deadline,
  action_label = EXCLUDED.action_label,
  status = 'approved',
  visibility = 'public',
  updated_at = NOW();

-- Current signup trigger: preserve explicit school_id from Auth metadata and
-- never create super_admin accounts automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
  raw_school_id TEXT;
  raw_grade TEXT;
  parsed_grade INT;
BEGIN
  raw_school_id := NEW.raw_user_meta_data->>'school_id';

  IF raw_school_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO target_school_id
    FROM public.schools
    WHERE id = raw_school_id::UUID
      AND is_active = TRUE
    LIMIT 1;
  END IF;

  IF target_school_id IS NULL THEN
    SELECT id INTO target_school_id
    FROM public.schools
    WHERE slug = 'school1'
      AND is_active = TRUE
    LIMIT 1;
  END IF;

  raw_grade := NEW.raw_user_meta_data->>'grade_level';
  IF raw_grade ~ '^[0-9]+$' THEN
    parsed_grade := raw_grade::INT;
  END IF;
  IF parsed_grade NOT BETWEEN 9 AND 12 THEN
    parsed_grade := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, grade_level, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'New user'),
    'student',
    target_school_id,
    parsed_grade,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
    grade_level = COALESCE(public.profiles.grade_level, EXCLUDED.grade_level),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
