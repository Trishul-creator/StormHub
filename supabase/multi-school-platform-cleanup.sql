-- StormHub patch: multi-school platform cleanup.
-- Run this after the existing StormHub patches.
-- Safe intent:
-- - Adds school metadata/settings needed by the app.
-- - Keeps the Elkhorn South pilot school as the default school.
-- - Hides standalone/non-core modules by default.
-- - Does not delete user accounts, memberships, notifications, or submitted feedback.

BEGIN;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Super admins are platform-level accounts and may not belong to one school.
ALTER TABLE public.profiles ALTER COLUMN school_id DROP NOT NULL;

INSERT INTO public.schools (
  id, name, short_name, slug, city, state, mascot, is_active, is_public
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Elkhorn South High School',
  'Elkhorn South',
  'elkhorn-south',
  'Omaha',
  'NE',
  'Storm',
  TRUE,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = COALESCE(public.schools.short_name, EXCLUDED.short_name),
  city = COALESCE(public.schools.city, EXCLUDED.city),
  state = COALESCE(public.schools.state, EXCLUDED.state),
  mascot = COALESCE(public.schools.mascot, EXCLUDED.mascot),
  is_active = TRUE,
  is_public = TRUE,
  updated_at = NOW();

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

INSERT INTO public.school_settings (
  school_id,
  announcements_enabled,
  events_enabled,
  resources_enabled,
  opportunities_enabled,
  volunteering_enabled,
  workshops_enabled,
  email_sending_enabled
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  FALSE,
  TRUE
)
ON CONFLICT (school_id) DO UPDATE SET
  announcements_enabled = EXCLUDED.announcements_enabled,
  events_enabled = EXCLUDED.events_enabled,
  resources_enabled = EXCLUDED.resources_enabled,
  opportunities_enabled = EXCLUDED.opportunities_enabled,
  volunteering_enabled = EXCLUDED.volunteering_enabled,
  workshops_enabled = EXCLUDED.workshops_enabled,
  email_sending_enabled = EXCLUDED.email_sending_enabled,
  updated_at = NOW();

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_settings_read" ON public.school_settings;
CREATE POLICY "school_settings_read" ON public.school_settings FOR SELECT
  USING (TRUE);

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

-- Optional school_id columns for school-aware notification/feedback reporting.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
UPDATE public.notifications n
SET school_id = COALESCE(p.school_id, 'a0000000-0000-4000-8000-000000000001'::UUID)
FROM public.profiles p
WHERE n.recipient_user_id = p.id AND n.school_id IS NULL;
UPDATE public.notifications
SET school_id = 'a0000000-0000-4000-8000-000000000001'
WHERE school_id IS NULL;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
UPDATE public.feedback
SET school_id = 'a0000000-0000-4000-8000-000000000001'
WHERE school_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_school_admin(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND (role = 'super_admin' OR school_id = school_uuid)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Normal auth signups are school-specific. Super admin accounts should be
-- promoted intentionally after creation and can have school_id cleared.
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
    WHERE slug = 'elkhorn-south'
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Public club visibility also requires an active/public school.
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs FOR SELECT
  USING (
    (
      is_listed = TRUE
      AND visibility = 'public'
      AND status IN ('interest_open', 'active')
      AND EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = clubs.school_id AND s.is_active = TRUE AND s.is_public = TRUE
      )
    )
    OR public.can_manage_club(id)
    OR public.is_school_admin(school_id)
  );

-- Hide non-core sample modules without deleting data.
UPDATE public.workshops SET status = 'archived' WHERE status <> 'archived';

-- Keep only the three pilot clubs listed/featured by default. Other clubs stay preserved as drafts.
UPDATE public.clubs
SET status = 'draft',
    is_listed = FALSE,
    is_featured = FALSE,
    visibility = 'unlisted',
    updated_at = NOW()
WHERE school_id = 'a0000000-0000-4000-8000-000000000001'
  AND slug NOT IN ('science-bowl', 'math-club', 'robotics-club');

UPDATE public.clubs
SET status = 'interest_open',
    is_listed = TRUE,
    is_featured = TRUE,
    is_active = TRUE,
    visibility = 'public',
    updated_at = NOW()
WHERE school_id = 'a0000000-0000-4000-8000-000000000001'
  AND slug IN ('science-bowl', 'math-club', 'robotics-club');

-- Archive obvious seeded/synthetic club content only. Real authored content is preserved.
UPDATE public.club_announcements
SET status = 'archived'
WHERE status <> 'archived' AND author_id IS NULL;

UPDATE public.club_resources
SET status = 'archived'
WHERE status <> 'archived' AND author_id IS NULL;

-- Archive known legacy/non-core opportunities. Do not delete user-created rows.
UPDATE public.opportunities
SET status = 'archived'
WHERE slug IN (
  'volunteer-hours',
  'workshop-host-app',
  'peer-tutoring-chemistry',
  'peer-tutoring-algebra',
  'youth-leadership-conference'
);

-- Ensure three clean pilot opportunities exist.
INSERT INTO public.opportunities (
  school_id, club_id, title, slug, summary, description, category, tags,
  eligibility, grade_min, grade_max, deadline, action_label, status, visibility
)
SELECT c.school_id, c.id,
  'Join Science Bowl', 'science-bowl-interest',
  'Register interest in Science Bowl practices and competition updates.',
  'Submit interest so the Science Bowl leaders and sponsor can follow up with meeting details.',
  'Interest Form', ARRAY['science', 'competition', 'club'],
  'Open to high school students', 9, 12,
  NOW() + INTERVAL '45 days', 'Sign Up', 'approved', 'public'
FROM public.clubs c
WHERE c.slug = 'science-bowl'
ON CONFLICT (slug) DO UPDATE SET
  club_id = EXCLUDED.club_id,
  status = 'approved',
  visibility = 'public';

INSERT INTO public.opportunities (
  school_id, club_id, title, slug, summary, description, category, tags,
  eligibility, grade_min, grade_max, deadline, action_label, status, visibility
)
SELECT c.school_id, c.id,
  'Join Robotics Club', 'robotics-club-interest',
  'Register interest in Robotics build sessions and team announcements.',
  'Submit interest so Robotics leaders and the sponsor can share next steps.',
  'Interest Form', ARRAY['robotics', 'engineering', 'club'],
  'Open to high school students', 9, 12,
  NOW() + INTERVAL '45 days', 'Sign Up', 'approved', 'public'
FROM public.clubs c
WHERE c.slug = 'robotics-club'
ON CONFLICT (slug) DO UPDATE SET
  club_id = EXCLUDED.club_id,
  status = 'approved',
  visibility = 'public';

INSERT INTO public.opportunities (
  school_id, club_id, title, slug, summary, description, category, tags,
  eligibility, grade_min, grade_max, deadline, action_label, status, visibility
)
SELECT c.school_id, c.id,
  'Math Club Contest Interest', 'math-club-contest-interest',
  'Get updates for Math Club contest prep and competition signups.',
  'Submit interest so Math Club leaders can send practice and contest information.',
  'Competition', ARRAY['math', 'competition', 'club'],
  'Open to high school students', 9, 12,
  NOW() + INTERVAL '45 days', 'Sign Up', 'approved', 'public'
FROM public.clubs c
WHERE c.slug = 'math-club'
ON CONFLICT (slug) DO UPDATE SET
  club_id = EXCLUDED.club_id,
  status = 'approved',
  visibility = 'public';

COMMIT;
