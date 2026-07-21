-- StormHub Database Schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website_url TEXT,
  mascot TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_settings (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
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

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id),
  full_name TEXT,
  email TEXT UNIQUE,
  grade_level INT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_description TEXT,
  long_description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  sponsor_name TEXT,
  sponsor_email TEXT,
  meeting_time TEXT,
  meeting_location TEXT,
  join_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'interest_open', 'active', 'paused', 'archived')),
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Club Memberships
CREATE TABLE IF NOT EXISTS club_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'rejected', 'left')),
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'officer', 'president', 'sponsor')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Club Announcements
CREATE TABLE IF NOT EXISTS club_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members', 'officers')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
  send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Club Resources
CREATE TABLE IF NOT EXISTS club_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT DEFAULT 'link' CHECK (resource_type IN ('link', 'file', 'text')),
  url TEXT,
  content TEXT,
  visibility TEXT DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'officers')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  club_id UUID REFERENCES clubs(id),
  author_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT,
  description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  eligibility TEXT,
  grade_min INT,
  grade_max INT,
  deadline TIMESTAMPTZ,
  event_date TIMESTAMPTZ,
  location TEXT,
  external_url TEXT,
  action_label TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members')),
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
  send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE,
  deadline_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  club_id UUID REFERENCES clubs(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'practice', 'workshop', 'competition', 'audition', 'info_session', 'deadline', 'other')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  external_url TEXT,
  max_attendees INT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members', 'officers')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
  send_email_to_members BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going' CHECK (status IN ('going', 'interested', 'not_going', 'waitlisted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshops
CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  club_id UUID REFERENCES clubs(id),
  host_user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  subject_area TEXT,
  skill_level TEXT,
  starts_at TIMESTAMPTZ,
  location TEXT,
  signup_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Hours
CREATE TABLE IF NOT EXISTS service_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id),
  opportunity_id UUID REFERENCES opportunities(id),
  title TEXT NOT NULL,
  organization TEXT,
  date_completed DATE NOT NULL,
  hours NUMERIC NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interest Forms
CREATE TABLE IF NOT EXISTS interest_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  club_id UUID REFERENCES clubs(id),
  opportunity_id UUID REFERENCES opportunities(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  grade_level INT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_id UUID REFERENCES profiles(id),
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only signup throttling. Identifiers are keyed hashes, never raw IPs or emails.
CREATE TABLE IF NOT EXISTS signup_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_hash TEXT,
  email_hash TEXT NOT NULL,
  was_successful BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_email_created
  ON signup_attempts(email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_created
  ON signup_attempts(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
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
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'simulated')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clubs_school ON clubs(school_id);
CREATE INDEX IF NOT EXISTS idx_clubs_slug ON clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_school ON opportunities(school_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_slug ON opportunities(slug);
CREATE INDEX IF NOT EXISTS idx_events_school ON events(school_id);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_opportunity_unique ON bookmarks(user_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_event_unique ON bookmarks(user_id, event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_club_unique ON bookmarks(user_id, club_id) WHERE club_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_hours_user_status ON service_hours(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created ON email_outbox(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_content_dedupe
  ON notifications (
    recipient_user_id, type,
    COALESCE(club_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(opportunity_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::UUID),
    title
  );

-- Supabase dashboard-created tables normally receive these API role grants.
-- Keep them explicit so a CLI reset behaves exactly like a hosted project;
-- row-level policies remain the authorization boundary.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

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

-- Auto-create profile on signup
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

INSERT INTO public.school_settings (school_id)
VALUES ('a0000000-0000-4000-8000-000000000001')
ON CONFLICT (school_id) DO NOTHING;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS schools_updated_at ON schools;
DROP TRIGGER IF EXISTS school_settings_updated_at ON school_settings;
DROP TRIGGER IF EXISTS clubs_updated_at ON clubs;
DROP TRIGGER IF EXISTS club_announcements_updated_at ON club_announcements;
DROP TRIGGER IF EXISTS club_resources_updated_at ON club_resources;
DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
DROP TRIGGER IF EXISTS events_updated_at ON events;
DROP TRIGGER IF EXISTS workshops_updated_at ON workshops;
DROP TRIGGER IF EXISTS service_hours_updated_at ON service_hours;
DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER school_settings_updated_at BEFORE UPDATE ON school_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER club_announcements_updated_at BEFORE UPDATE ON club_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER club_resources_updated_at BEFORE UPDATE ON club_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workshops_updated_at BEFORE UPDATE ON workshops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER service_hours_updated_at BEFORE UPDATE ON service_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevent users from escalating their own role via client updates
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- SQL Editor, migrations, and other trusted database-owner operations do not
    -- carry an authenticated user JWT and must be able to bootstrap administrators.
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

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();

CREATE OR REPLACE FUNCTION public.enforce_content_approval()
RETURNS TRIGGER AS $$
DECLARE actor_role TEXT; content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NEW.status <> 'approved' THEN RETURN NEW; END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  content_club_id := NEW.club_id;
  IF actor_role IN ('admin', 'super_admin') THEN RETURN NEW; END IF;
  IF actor_role = 'teacher' AND content_club_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = content_club_id AND user_id = auth.uid()
      AND status = 'active' AND role = 'sponsor'
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'This content requires teacher or administrator approval';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS announcements_enforce_approval ON club_announcements;
CREATE TRIGGER announcements_enforce_approval BEFORE INSERT OR UPDATE ON club_announcements FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS resources_enforce_approval ON club_resources;
CREATE TRIGGER resources_enforce_approval BEFORE INSERT OR UPDATE ON club_resources FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS opportunities_enforce_approval ON opportunities;
CREATE TRIGGER opportunities_enforce_approval BEFORE INSERT OR UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS events_enforce_approval ON events;
CREATE TRIGGER events_enforce_approval BEFORE INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();
DROP TRIGGER IF EXISTS workshops_enforce_approval ON workshops;
CREATE TRIGGER workshops_enforce_approval BEFORE INSERT OR UPDATE ON workshops FOR EACH ROW EXECUTE FUNCTION public.enforce_content_approval();

-- Owners may correct submitted/rejected logs, but they cannot approve their own
-- hours or rewrite an approved record. Trusted approvers are handled by RLS.
CREATE OR REPLACE FUNCTION prevent_service_hour_self_approval()
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

DROP TRIGGER IF EXISTS service_hours_prevent_self_approval ON service_hours;
CREATE TRIGGER service_hours_prevent_self_approval
  BEFORE UPDATE ON service_hours
  FOR EACH ROW EXECUTE FUNCTION prevent_service_hour_self_approval();
