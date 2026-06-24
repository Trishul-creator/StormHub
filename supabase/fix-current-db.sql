-- StormHub non-destructive patch for an existing Supabase project.
-- Run this entire file in Supabase SQL Editor. It does not delete application data
-- or remove memberships. Legacy club_officer/teacher_sponsor roles are migrated
-- to student/teacher while club-specific assignments remain in memberships.

BEGIN;

INSERT INTO public.schools (id, name, slug, city, state, mascot)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Elkhorn South High School',
  'elkhorn-south',
  'Omaha',
  'NE',
  'Storm'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.service_hours ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.service_hours ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE public.club_announcements ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.club_announcements ADD COLUMN IF NOT EXISTS send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deadline_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.club_announcements DROP CONSTRAINT IF EXISTS club_announcements_importance_check;
ALTER TABLE public.club_announcements ADD CONSTRAINT club_announcements_importance_check
  CHECK (importance IN ('normal', 'important', 'urgent'));
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_importance_check;
ALTER TABLE public.events ADD CONSTRAINT events_importance_check
  CHECK (importance IN ('normal', 'important', 'urgent'));
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_importance_check;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_importance_check
  CHECK (importance IN ('normal', 'important', 'urgent'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'club_announcement', 'club_event_created', 'club_event_updated',
    'club_event_canceled', 'club_opportunity_created',
    'opportunity_deadline_soon', 'approval_needed', 'content_approved',
    'content_rejected', 'system_message'
  )),
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  club_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  opportunity_deadlines_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  important_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  urgent_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  admin_attention_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'simulated')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON public.email_outbox(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_content_dedupe
  ON public.notifications (
    recipient_user_id, type,
    COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(opportunity_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::UUID),
    title
  );

CREATE OR REPLACE FUNCTION public.prevent_notification_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.importance IS DISTINCT FROM OLD.importance
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.link IS DISTINCT FROM OLD.link
    OR NEW.club_id IS DISTINCT FROM OLD.club_id
    OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only notification read state can be updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS notifications_prevent_content_update ON public.notifications;
CREATE TRIGGER notifications_prevent_content_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_notification_content_update();

-- Simplified product model. Service-hour data is preserved but the feature is
-- disabled in the application because the school uses a separate system.
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE public.clubs SET status = 'draft' WHERE status IS NULL OR status NOT IN ('draft', 'interest_open', 'active', 'paused', 'archived');
UPDATE public.clubs SET is_listed = FALSE WHERE is_listed IS NULL;
ALTER TABLE public.clubs ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.clubs ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.clubs ALTER COLUMN is_listed SET DEFAULT FALSE;
ALTER TABLE public.clubs ALTER COLUMN is_listed SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = 'student' WHERE role = 'club_officer';
UPDATE public.profiles SET role = 'teacher' WHERE role = 'teacher_sponsor';
UPDATE public.profiles SET role = 'student' WHERE role NOT IN ('student', 'teacher', 'admin', 'super_admin');
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'super_admin'));

ALTER TABLE public.club_memberships DROP CONSTRAINT IF EXISTS club_memberships_role_check;
UPDATE public.club_memberships
SET role = 'officer'
WHERE role IN ('vice_president', 'secretary', 'treasurer', 'admin');
UPDATE public.club_memberships SET role = 'member' WHERE role NOT IN ('member', 'officer', 'president', 'sponsor');
ALTER TABLE public.club_memberships
  ADD CONSTRAINT club_memberships_role_check
  CHECK (role IN ('member', 'officer', 'president', 'sponsor'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
UPDATE public.events
SET event_type = 'other'
WHERE event_type IN ('volunteer', 'performance', 'social');
UPDATE public.events
SET event_type = 'other'
WHERE event_type NOT IN ('meeting', 'practice', 'workshop', 'competition', 'audition', 'info_session', 'deadline', 'other');
ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check
  CHECK (event_type IN ('meeting', 'practice', 'workshop', 'competition', 'audition', 'info_session', 'deadline', 'other'));

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_status_check;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_status_check
  CHECK (status IN ('draft', 'interest_open', 'active', 'paused', 'archived'));

UPDATE public.clubs
SET status = 'draft',
    is_listed = FALSE,
    is_featured = FALSE
WHERE slug NOT IN ('science-bowl', 'math-club', 'robotics-club');

UPDATE public.clubs
SET status = 'interest_open',
    is_listed = TRUE,
    is_featured = TRUE,
    is_active = TRUE,
    visibility = 'public'
WHERE slug IN ('science-bowl', 'math-club', 'robotics-club');

-- Preserve legacy volunteering rows but keep them out of the simplified app.
UPDATE public.opportunities
SET status = 'archived'
WHERE category = 'Volunteering' OR slug = 'volunteer-hours';

UPDATE public.opportunities SET category = 'Interest Form', action_label = 'Sign Up' WHERE slug = 'join-science-bowl';
UPDATE public.opportunities SET category = 'Application', action_label = 'Apply' WHERE slug = 'join-robotics';
UPDATE public.opportunities SET category = 'Workshop', action_label = 'Sign Up' WHERE slug IN ('amc-prep-group', 'peer-tutoring-chemistry', 'peer-tutoring-algebra');
UPDATE public.opportunities SET category = 'Audition', action_label = 'Register' WHERE slug = 'music-audition-reminder';
UPDATE public.opportunities SET category = 'Interest Form', action_label = 'Sign Up' WHERE slug = 'research-interest';
UPDATE public.opportunities SET category = 'Application', action_label = 'Apply' WHERE slug = 'workshop-host-app';

-- Opportunities are school-wide action items, not club content. Existing rows
-- are preserved while the old club relationship is cleared.
UPDATE public.opportunities SET club_id = NULL WHERE club_id IS NOT NULL;
UPDATE public.opportunities
SET status = 'archived'
WHERE slug IN ('join-science-bowl', 'join-robotics');

INSERT INTO public.opportunities (
  school_id, club_id, title, slug, summary, description, category, tags,
  eligibility, grade_min, grade_max, deadline, event_date, location,
  action_label, status, visibility
) VALUES
(
  'a0000000-0000-4000-8000-000000000001', NULL,
  'Metro Student Science Fair', 'metro-student-science-fair',
  'Present an original science or engineering project to local judges.',
  'Register to present an individual or team project at the Metro Student Science Fair.',
  'Competition', ARRAY['science', 'research', 'engineering'],
  'Open to students in grades 9-12', 9, 12,
  NOW() + INTERVAL '28 days', NOW() + INTERVAL '45 days',
  'UNO Milo Bail Student Center', 'Register', 'approved', 'public'
),
(
  'a0000000-0000-4000-8000-000000000001', NULL,
  'Nebraska College Meet and Greet', 'nebraska-college-meet-and-greet',
  'Meet admissions representatives and learn about programs, scholarships, and campus life.',
  'Students can speak with representatives from colleges across Nebraska and prepare questions about admissions and financial aid.',
  'College', ARRAY['college', 'admissions', 'scholarships'],
  'Open to all students and families', 9, 12,
  NOW() + INTERVAL '18 days', NOW() + INTERVAL '24 days',
  'Elkhorn South Commons', 'Sign Up', 'approved', 'public'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.events
SET status = 'archived'
WHERE slug = 'volunteer-fair';

-- Add bookmark uniqueness only when legacy data has no duplicates. Existing rows
-- are never deleted by this patch.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookmarks
    WHERE opportunity_id IS NOT NULL
    GROUP BY user_id, opportunity_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_opportunity_unique
      ON public.bookmarks(user_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bookmarks
    WHERE event_id IS NOT NULL
    GROUP BY user_id, event_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_event_unique
      ON public.bookmarks(user_id, event_id) WHERE event_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bookmarks
    WHERE club_id IS NOT NULL
    GROUP BY user_id, club_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_club_unique
      ON public.bookmarks(user_id, club_id) WHERE club_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_hours_user_status
  ON public.service_hours(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON public.approval_requests(status, created_at);

-- Safe signup trigger: always creates a student profile and tolerates retries.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
BEGIN
  SELECT id INTO target_school_id
  FROM public.schools
  WHERE slug = 'elkhorn-south'
  LIMIT 1;

  IF target_school_id IS NULL THEN
    INSERT INTO public.schools (name, slug)
    VALUES ('Elkhorn South High School', 'elkhorn-south')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO target_school_id;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'New user'),
    'student',
    target_school_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Preserve the existing updated_at trigger behavior.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS service_hours_updated_at ON public.service_hours;
CREATE TRIGGER service_hours_updated_at
  BEFORE UPDATE ON public.service_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Authenticated users cannot change roles unless their current profile is an
-- admin. SQL Editor/database-owner operations have auth.uid() = NULL and remain
-- able to promote the first administrator.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    IF actor_role NOT IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Only an admin can change profile roles';
    END IF;
    IF actor_role = 'admin' AND (
      OLD.role NOT IN ('student', 'teacher')
      OR NEW.role NOT IN ('student', 'teacher')
    ) THEN
      RAISE EXCEPTION 'Only a super admin can modify admin-level accounts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

CREATE OR REPLACE FUNCTION public.enforce_content_approval()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  content_club_id := NEW.club_id;
  IF actor_role IN ('admin', 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF actor_role = 'teacher' AND content_club_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = content_club_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = 'sponsor'
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This content requires teacher or administrator approval';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS announcements_enforce_approval ON public.club_announcements;
CREATE TRIGGER announcements_enforce_approval BEFORE INSERT OR UPDATE ON public.club_announcements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS resources_enforce_approval ON public.club_resources;
CREATE TRIGGER resources_enforce_approval BEFORE INSERT OR UPDATE ON public.club_resources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS opportunities_enforce_approval ON public.opportunities;
CREATE TRIGGER opportunities_enforce_approval BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS events_enforce_approval ON public.events;
CREATE TRIGGER events_enforce_approval BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS workshops_enforce_approval ON public.workshops;
CREATE TRIGGER workshops_enforce_approval BEFORE INSERT OR UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();

CREATE OR REPLACE FUNCTION public.prevent_service_hour_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Approved service-hour logs can only be changed by an approver';
    END IF;
    IF NEW.status = 'approved' THEN
      RAISE EXCEPTION 'Users cannot approve their own service hours';
    END IF;
    NEW.approved_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS service_hours_prevent_self_approval ON public.service_hours;
CREATE TRIGGER service_hours_prevent_self_approval
  BEFORE UPDATE ON public.service_hours
  FOR EACH ROW EXECUTE FUNCTION public.prevent_service_hour_self_approval();

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_approve_content()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('teacher', 'admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_member(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = club_uuid
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (
        (p.role = 'student' AND m.role IN ('officer', 'president'))
        OR (p.role = 'teacher' AND m.role = 'sponsor')
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club_roster(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND p.role = 'teacher'
      AND m.role = 'sponsor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  actor_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

  IF actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF actor_role = 'admin' AND (
    target_role NOT IN ('student', 'teacher')
    OR new_role NOT IN ('student', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Only a super admin can modify admin-level accounts';
  END IF;
  IF new_role = 'teacher' AND COALESCE(array_length(assigned_club_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'A teacher must be assigned to at least one club';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  UPDATE public.club_memberships
  SET role = 'member', status = 'left'
  WHERE user_id = target_user_id
    AND role = 'sponsor'
    AND (
      new_role <> 'teacher'
      OR NOT (club_id = ANY(assigned_club_ids))
    );

  IF new_role = 'teacher' THEN
    UPDATE public.club_memberships
    SET role = 'member', status = 'left'
    WHERE user_id = target_user_id
      AND NOT (club_id = ANY(assigned_club_ids));
    INSERT INTO public.club_memberships (club_id, user_id, status, role)
    SELECT club_id, target_user_id, 'active', 'sponsor'
    FROM unnest(assigned_club_ids) AS assigned(club_id)
    WHERE EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = assigned.club_id)
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET status = 'active', role = 'sponsor';
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.manage_club_roster_member(
  target_club_id UUID,
  target_user_id UUID,
  new_membership_role TEXT,
  remove_member BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  target_profile_role TEXT;
BEGIN
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Teacher sponsor or administrator access required';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own roster assignment';
  END IF;

  SELECT role INTO target_profile_role
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_profile_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF remove_member THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE club_id = target_club_id AND user_id = target_user_id;
    RETURN;
  END IF;

  IF target_profile_role <> 'student' THEN
    RAISE EXCEPTION 'Only students can be assigned member, officer, or president roles';
  END IF;
  IF new_membership_role NOT IN ('member', 'officer', 'president') THEN
    RAISE EXCEPTION 'Invalid student club role';
  END IF;

  INSERT INTO public.club_memberships (club_id, user_id, status, role)
  VALUES (target_club_id, target_user_id, 'active', new_membership_role)
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET status = 'active', role = EXCLUDED.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_club_roster_member(UUID, UUID, TEXT, BOOLEAN) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Replace policies affected by role, ownership, approval, or deletion rules.
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs FOR SELECT
  USING (
    (is_listed = TRUE AND visibility = 'public' AND status IN ('interest_open', 'active'))
    OR can_manage_club(id)
    OR is_admin()
  );

DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_roster_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_roster_read" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships m
      WHERE m.user_id = profiles.id
        AND public.can_manage_club_roster(m.club_id)
    )
  );
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'student');
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_manage" ON public.profiles FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "memberships_read_own" ON public.club_memberships;
DROP POLICY IF EXISTS "memberships_read" ON public.club_memberships;
DROP POLICY IF EXISTS "memberships_insert_own" ON public.club_memberships;
DROP POLICY IF EXISTS "memberships_update_own" ON public.club_memberships;
DROP POLICY IF EXISTS "memberships_delete_own" ON public.club_memberships;
CREATE POLICY "memberships_read" ON public.club_memberships FOR SELECT
  USING (user_id = auth.uid() OR can_manage_club(club_id) OR can_manage_club_roster(club_id) OR is_admin());
CREATE POLICY "memberships_insert_own" ON public.club_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'pending'));
CREATE POLICY "memberships_update_own" ON public.club_memberships FOR UPDATE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin())
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'left'))
    OR can_manage_club_roster(club_id)
    OR is_admin()
  );
CREATE POLICY "memberships_delete_own" ON public.club_memberships FOR DELETE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin());

DROP POLICY IF EXISTS "rsvps_read" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_insert_own" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_update_own" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_delete_own" ON public.event_rsvps;
CREATE POLICY "rsvps_read" ON public.event_rsvps FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "rsvps_insert_own" ON public.event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_update_own" ON public.event_rsvps FOR UPDATE
  USING (user_id = auth.uid() AND get_user_role() = 'student')
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_delete_own" ON public.event_rsvps FOR DELETE
  USING (user_id = auth.uid() AND get_user_role() = 'student');

DROP POLICY IF EXISTS "bookmarks_own" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks_read_own" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks_update_own" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON public.bookmarks;
CREATE POLICY "bookmarks_read_own" ON public.bookmarks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "bookmarks_insert_own" ON public.bookmarks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (opportunity_id IS NULL OR get_user_role() = 'student')
  );
CREATE POLICY "bookmarks_update_own" ON public.bookmarks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (opportunity_id IS NULL OR get_user_role() = 'student')
  );
CREATE POLICY "bookmarks_delete_own" ON public.bookmarks FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_hours_own" ON public.service_hours;
DROP POLICY IF EXISTS "service_hours_read" ON public.service_hours;
DROP POLICY IF EXISTS "service_hours_insert_own" ON public.service_hours;
DROP POLICY IF EXISTS "service_hours_update_own" ON public.service_hours;
DROP POLICY IF EXISTS "service_hours_delete_own" ON public.service_hours;
DROP POLICY IF EXISTS "service_hours_approver_manage" ON public.service_hours;
-- Volunteering/service hours disabled because school uses a separate system.
-- RLS remains enabled with no client policies; existing rows are preserved.

DROP POLICY IF EXISTS "approvals_manage" ON public.approval_requests;
DROP POLICY IF EXISTS "approvals_read" ON public.approval_requests;
DROP POLICY IF EXISTS "approvals_insert_own" ON public.approval_requests;
DROP POLICY IF EXISTS "approvals_approver_update" ON public.approval_requests;
CREATE POLICY "approvals_read" ON public.approval_requests FOR SELECT
  USING (submitted_by = auth.uid() OR can_approve_content());
CREATE POLICY "approvals_insert_own" ON public.approval_requests FOR INSERT
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "approvals_approver_update" ON public.approval_requests FOR UPDATE
  USING (can_approve_content()) WITH CHECK (can_approve_content());

-- Approvers can update pending content rows. Existing public/member read and
-- officer-management policies remain intact.
DROP POLICY IF EXISTS "announcements_approve" ON public.club_announcements;
CREATE POLICY "announcements_approve" ON public.club_announcements FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));
DROP POLICY IF EXISTS "resources_approve" ON public.club_resources;
CREATE POLICY "resources_approve" ON public.club_resources FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));
DROP POLICY IF EXISTS "opportunities_public_read" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_read" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_manage" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_approve" ON public.opportunities;
CREATE POLICY "opportunities_read" ON public.opportunities FOR SELECT
  USING (
    (
      status = 'approved'
      AND visibility = 'public'
      AND (auth.uid() IS NULL OR get_user_role() <> 'teacher')
    )
    OR is_admin()
  );
CREATE POLICY "opportunities_manage" ON public.opportunities FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);
CREATE POLICY "opportunities_approve" ON public.opportunities FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);
DROP POLICY IF EXISTS "events_approve" ON public.events;
CREATE POLICY "events_approve" ON public.events FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));
DROP POLICY IF EXISTS "workshops_approve" ON public.workshops;
DROP POLICY IF EXISTS "workshops_public_read" ON public.workshops;
DROP POLICY IF EXISTS "workshops_read" ON public.workshops;
CREATE POLICY "workshops_read" ON public.workshops FOR SELECT
  USING (
    status = 'approved'
    OR is_admin()
    OR (club_id IS NOT NULL AND get_user_role() = 'teacher' AND can_manage_club(club_id))
  );
CREATE POLICY "workshops_approve" ON public.workshops FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));

DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_read_own" ON public.notifications FOR SELECT
  USING (recipient_user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_read_own" ON public.notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_read_own" ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "email_outbox_admin_read" ON public.email_outbox;
CREATE POLICY "email_outbox_admin_read" ON public.email_outbox FOR SELECT
  USING (is_admin());

COMMIT;
