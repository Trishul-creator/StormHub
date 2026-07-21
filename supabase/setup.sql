-- LEGACY REFERENCE ONLY. Do not use for new or production databases.
-- StormHub complete setup — superseded by supabase/migrations
-- Order: schema → policies → seed

-- ========== SCHEMA ==========
-- StormHub Database Schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website_url TEXT,
  mascot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS clubs_updated_at ON clubs;
DROP TRIGGER IF EXISTS club_announcements_updated_at ON club_announcements;
DROP TRIGGER IF EXISTS club_resources_updated_at ON club_resources;
DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
DROP TRIGGER IF EXISTS events_updated_at ON events;
DROP TRIGGER IF EXISTS workshops_updated_at ON workshops;
DROP TRIGGER IF EXISTS service_hours_updated_at ON service_hours;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER club_announcements_updated_at BEFORE UPDATE ON club_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER club_resources_updated_at BEFORE UPDATE ON club_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workshops_updated_at BEFORE UPDATE ON workshops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER service_hours_updated_at BEFORE UPDATE ON service_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevent users from escalating their own role via client updates
CREATE OR REPLACE FUNCTION prevent_role_escalation()
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

-- ========== POLICIES ==========
-- StormHub Row Level Security Policies

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'schools', 'profiles', 'clubs', 'club_memberships',
        'club_announcements', 'club_resources', 'opportunities', 'events',
        'event_rsvps', 'bookmarks', 'workshops', 'service_hours',
        'interest_forms', 'approval_requests', 'analytics_events', 'feedback',
        'signup_attempts'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END $$;

-- Helper: get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Helper: is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
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

-- Helper: is club member
CREATE OR REPLACE FUNCTION public.is_club_member(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = club_uuid
    AND user_id = auth.uid()
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Helper: is club officer/sponsor for club
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
    SELECT 1 FROM public.club_memberships m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.club_id = club_uuid AND m.user_id = auth.uid()
      AND m.status = 'active' AND p.role = 'teacher' AND m.role = 'sponsor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE actor_role TEXT; target_role TEXT;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;
  IF actor_role NOT IN ('admin', 'super_admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF actor_role = 'admin' AND (
    target_role NOT IN ('student', 'teacher') OR new_role NOT IN ('student', 'teacher')
  ) THEN RAISE EXCEPTION 'Only a super admin can modify admin-level accounts'; END IF;
  IF new_role = 'teacher' AND COALESCE(array_length(assigned_club_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'A teacher must be assigned to at least one club';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
  UPDATE public.club_memberships SET role = 'member', status = 'left'
  WHERE user_id = target_user_id AND role = 'sponsor'
    AND (new_role <> 'teacher' OR NOT (club_id = ANY(assigned_club_ids)));

  IF new_role = 'teacher' THEN
    UPDATE public.club_memberships SET role = 'member', status = 'left'
    WHERE user_id = target_user_id
      AND NOT (club_id = ANY(assigned_club_ids));
    INSERT INTO public.club_memberships (club_id, user_id, status, role)
    SELECT assigned.club_id, target_user_id, 'active', 'sponsor'
    FROM unnest(assigned_club_ids) AS assigned(club_id)
    WHERE EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = assigned.club_id)
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET status = 'active', role = 'sponsor';
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships SET status = 'left', role = 'member'
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
DECLARE target_profile_role TEXT;
BEGIN
  IF NOT public.can_manage_club_roster(target_club_id) THEN
    RAISE EXCEPTION 'Teacher sponsor or administrator access required';
  END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own roster assignment'; END IF;
  SELECT role INTO target_profile_role FROM public.profiles WHERE id = target_user_id;
  IF target_profile_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF remove_member THEN
    UPDATE public.club_memberships SET status = 'left', role = 'member'
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

-- Schools: public read, super_admin write
CREATE POLICY "schools_public_read" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_super_admin_write" ON schools FOR ALL USING (get_user_role() = 'super_admin');

-- Profiles: users read/update own, admins read all in school
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_roster_read" ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships m
      WHERE m.user_id = profiles.id AND can_manage_club_roster(m.club_id)
    )
  );
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'student');
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_manage" ON profiles FOR ALL USING (is_admin());

-- Clubs: public read active public clubs
CREATE POLICY "clubs_public_read" ON clubs FOR SELECT
  USING (
    (is_listed = true AND visibility = 'public' AND status IN ('interest_open', 'active'))
    OR can_manage_club(id)
    OR is_admin()
  );
CREATE POLICY "clubs_admin_manage" ON clubs FOR ALL USING (is_admin());
CREATE POLICY "clubs_officer_manage" ON clubs FOR UPDATE USING (can_manage_club(id));

-- Club memberships
CREATE POLICY "memberships_read_own" ON club_memberships FOR SELECT
  USING (user_id = auth.uid() OR can_manage_club(club_id) OR can_manage_club_roster(club_id) OR is_admin());
CREATE POLICY "memberships_insert_own" ON club_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'pending'));
CREATE POLICY "memberships_update_own" ON club_memberships FOR UPDATE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin())
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member' AND status IN ('active', 'left'))
    OR can_manage_club_roster(club_id)
    OR is_admin()
  );
CREATE POLICY "memberships_delete_own" ON club_memberships FOR DELETE
  USING (user_id = auth.uid() OR can_manage_club_roster(club_id) OR is_admin());

-- Announcements: public approved public visibility
CREATE POLICY "announcements_public_read" ON club_announcements FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND is_club_member(club_id))
    OR can_manage_club(club_id)
    OR is_admin()
  );
CREATE POLICY "announcements_officer_insert" ON club_announcements FOR INSERT
  WITH CHECK (can_manage_club(club_id) OR is_admin());
CREATE POLICY "announcements_officer_update" ON club_announcements FOR UPDATE
  USING (can_manage_club(club_id) OR is_admin());
CREATE POLICY "announcements_approve" ON club_announcements FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));

-- Resources
CREATE POLICY "resources_read" ON club_resources FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND is_club_member(club_id))
    OR can_manage_club(club_id)
    OR is_admin()
  );
CREATE POLICY "resources_officer_write" ON club_resources FOR ALL
  USING (can_manage_club(club_id) OR is_admin())
  WITH CHECK (can_manage_club(club_id) OR is_admin());
CREATE POLICY "resources_approve" ON club_resources FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND can_manage_club(club_id)));

-- Opportunities
CREATE POLICY "opportunities_public_read" ON opportunities FOR SELECT
  USING (
    (
      status = 'approved'
      AND visibility = 'public'
      AND (auth.uid() IS NULL OR get_user_role() <> 'teacher')
    )
    OR is_admin()
  );
CREATE POLICY "opportunities_manage" ON opportunities FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);
CREATE POLICY "opportunities_approve" ON opportunities FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin() AND club_id IS NULL);

-- Events
CREATE POLICY "events_public_read" ON events FOR SELECT
  USING (
    (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'members' AND club_id IS NOT NULL AND is_club_member(club_id))
    OR can_manage_club(club_id)
    OR is_admin()
  );
CREATE POLICY "events_manage" ON events FOR ALL
  USING (is_admin() OR (club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (club_id IS NOT NULL AND can_manage_club(club_id)));
CREATE POLICY "events_approve" ON events FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));

-- RSVPs
CREATE POLICY "rsvps_read" ON event_rsvps FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "rsvps_insert_own" ON event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_update_own" ON event_rsvps FOR UPDATE
  USING (user_id = auth.uid() AND get_user_role() = 'student')
  WITH CHECK (user_id = auth.uid() AND get_user_role() = 'student');
CREATE POLICY "rsvps_delete_own" ON event_rsvps FOR DELETE
  USING (user_id = auth.uid() AND get_user_role() = 'student');

-- Bookmarks
CREATE POLICY "bookmarks_read_own" ON bookmarks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "bookmarks_insert_own" ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (opportunity_id IS NULL OR get_user_role() = 'student'));
CREATE POLICY "bookmarks_update_own" ON bookmarks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (opportunity_id IS NULL OR get_user_role() = 'student'));
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- Workshops
CREATE POLICY "workshops_public_read" ON workshops FOR SELECT
  USING (
    status = 'approved'
    OR is_admin()
    OR (club_id IS NOT NULL AND get_user_role() = 'teacher' AND can_manage_club(club_id))
  );
CREATE POLICY "workshops_insert" ON workshops FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND host_user_id = auth.uid());
CREATE POLICY "workshops_admin_manage" ON workshops FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "workshops_approve" ON workshops FOR UPDATE
  USING (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)))
  WITH CHECK (is_admin() OR (get_user_role() = 'teacher' AND club_id IS NOT NULL AND can_manage_club(club_id)));

-- Service hours
-- Volunteering/service hours disabled because school uses a separate system.
-- RLS remains enabled with no client policies.

-- Interest forms: anyone can submit
CREATE POLICY "interest_forms_insert" ON interest_forms FOR INSERT
  WITH CHECK (true);
CREATE POLICY "interest_forms_admin_read" ON interest_forms FOR SELECT
  USING (is_admin());

-- Approval requests
CREATE POLICY "approvals_read" ON approval_requests FOR SELECT
  USING (submitted_by = auth.uid() OR can_approve_content());
CREATE POLICY "approvals_insert_own" ON approval_requests FOR INSERT
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "approvals_approver_update" ON approval_requests FOR UPDATE
  USING (can_approve_content()) WITH CHECK (can_approve_content());

-- Analytics: insert for authenticated, read for admin
CREATE POLICY "analytics_insert" ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "analytics_admin_read" ON analytics_events FOR SELECT
  USING (is_admin());

-- Feedback
CREATE POLICY "feedback_insert" ON feedback FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );
CREATE POLICY "feedback_admin_read" ON feedback FOR SELECT
  USING (is_admin());
CREATE POLICY "feedback_admin_update" ON feedback FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "notifications_read_own" ON notifications FOR SELECT
  USING (recipient_user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY "notification_preferences_read_own" ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "notification_preferences_insert_own" ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notification_preferences_update_own" ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "email_outbox_admin_read" ON email_outbox FOR SELECT
  USING (get_user_role() = 'super_admin');

-- ========== SEED DATA ==========
-- StormHub Seed Data for Elkhorn South High School
-- Run after schema.sql

-- School
INSERT INTO schools (id, name, slug, city, state, mascot, website_url)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Elkhorn South High School',
  'elkhorn-south',
  'Omaha',
  'Nebraska',
  'Storm',
  'https://www.elkhornsouth.org'
) ON CONFLICT (slug) DO NOTHING;

-- Featured Clubs
INSERT INTO clubs (id, school_id, name, slug, short_description, long_description, category, tags, meeting_time, meeting_location, join_instructions, is_featured, is_active, visibility) VALUES
('c0000001-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Science Bowl', 'science-bowl',
 'Competitive buzzer-based science and math team preparing for regional and national-level competitions.',
 'Science Bowl is for students who enjoy fast-paced science and math questions. Members practice topics such as biology, chemistry, physics, earth science, astronomy, energy, and math. The club includes weekly practice, subject study groups, mock rounds, and tournament preparation.',
 'Science', ARRAY['science', 'competition', 'buzzer', 'physics', 'chemistry', 'biology', 'earth science', 'astronomy', 'math'],
 'TBD', 'TBD', 'Join the club to receive practice schedules, subject resources, tryout information, and tournament updates.', true, true, 'public'),

('c0000001-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Math Club', 'math-club',
 'A community for students interested in contest math, problem solving, AMC/AIME preparation, and math enrichment.',
 'Math Club helps students explore mathematical problem solving beyond the classroom. Members can prepare for contests such as AMC, work on challenging problems, run student-led lessons, and form study groups for algebra, geometry, combinatorics, number theory, and probability.',
 'Math', ARRAY['AMC', 'AIME', 'contests', 'problem solving', 'olympiad', 'math team'],
 'TBD', 'TBD', 'Join for announcements about practices, competitions, problem sets, and student-led workshops.', true, true, 'public'),

('c0000001-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Robotics Club', 'robotics-club',
 'Hands-on robotics team focused on designing, building, programming, and competing with robots.',
 'Robotics Club gives students experience with engineering design, coding, mechanical systems, CAD, strategy, teamwork, and competition. Members work on robot design, programming, build sessions, driver practice, and tournament preparation.',
 'Engineering', ARRAY['robotics', 'VEX', 'programming', 'engineering', 'CAD', 'controls', 'design', 'build'],
 'TBD', 'TBD', 'Join to receive build session schedules, competition details, team updates, and resource links.', true, true, 'public')
ON CONFLICT (slug) DO NOTHING;

-- Additional Clubs
INSERT INTO clubs (school_id, name, slug, short_description, category, tags, meeting_time, meeting_location, join_instructions, is_featured, is_active, visibility) VALUES
('a0000000-0000-4000-8000-000000000001', 'Academic Decathlon', 'academic-decathlon', 'Academic competition team covering ten subjects.', 'Competition', ARRAY['academics', 'competition'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'AMC', 'amc', 'American Mathematics Competitions preparation.', 'Math', ARRAY['math', 'AMC'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Ambassador Club', 'ambassador-club', 'Student ambassadors welcoming new students.', 'Leadership', ARRAY['leadership', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Art Club', 'art-club', 'Creative space for visual arts enthusiasts.', 'Arts', ARRAY['art', 'creativity'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Band', 'band', 'Concert and marching band program.', 'Music', ARRAY['music', 'band'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Cheerleading', 'cheerleading', 'School spirit and athletic cheer team.', 'Sports', ARRAY['cheer', 'spirit'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Color Guard / Winter Guard', 'color-guard', 'Performance ensemble with flags and dance.', 'Music', ARRAY['guard', 'performance'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Dance Team', 'dance-team', 'Competitive and performance dance.', 'Sports', ARRAY['dance', 'performance'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Debate', 'debate', 'Competitive debate and public speaking.', 'Competition', ARRAY['debate', 'speaking'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'DECA', 'deca', 'Business and marketing competition club.', 'Leadership', ARRAY['business', 'DECA'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Drama Club', 'drama-club', 'Theater productions and acting workshops.', 'Arts', ARRAY['drama', 'theater'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'E Club', 'e-club', 'Letter winners athletic leadership club.', 'Leadership', ARRAY['athletics', 'leadership'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'FBLA', 'fbla', 'Future Business Leaders of America.', 'Leadership', ARRAY['business', 'FBLA'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'FCCLA', 'fccla', 'Family, Career and Community Leaders.', 'Leadership', ARRAY['FCCLA', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Intramurals', 'intramurals', 'Casual sports and recreation leagues.', 'Sports', ARRAY['sports', 'recreation'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Japanese Club', 'japanese-club', 'Japanese language and culture exploration.', 'Language/Culture', ARRAY['japanese', 'culture'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Journalism', 'journalism', 'School newspaper and media production.', 'Arts', ARRAY['journalism', 'media'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Mock Trial', 'mock-trial', 'Simulated courtroom competition team.', 'Competition', ARRAY['law', 'debate'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'National Honor Society', 'national-honor-society', 'Academic honor society with service requirements.', 'Leadership', ARRAY['NHS', 'service', 'academics'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Olympus Club', 'olympus-club', 'School spirit and community engagement.', 'Leadership', ARRAY['spirit', 'community'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'One Act Play', 'one-act-play', 'Competitive one-act theater productions.', 'Arts', ARRAY['theater', 'competition'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Pep Club', 'pep-club', 'School spirit and game day support.', 'Leadership', ARRAY['spirit', 'pep'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Play Production', 'play-production', 'Full-length theater productions.', 'Arts', ARRAY['theater', 'production'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Power Drive', 'power-drive', 'Electric vehicle design and competition.', 'Engineering', ARRAY['engineering', 'electric'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Quiz Bowl', 'quiz-bowl', 'Academic trivia competition team.', 'Competition', ARRAY['trivia', 'academics'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'SADD', 'sadd', 'Students Against Destructive Decisions.', 'Service', ARRAY['safety', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Show Choir', 'show-choir', 'Vocal and dance performance ensemble.', 'Music', ARRAY['choir', 'dance', 'music'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Speech', 'speech', 'Competitive speech and oral interpretation.', 'Competition', ARRAY['speech', 'speaking'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Student Council', 'student-council', 'Student government and school leadership.', 'Leadership', ARRAY['government', 'leadership'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Teams +', 'teams-plus', 'Inclusive athletics and activities program.', 'Sports', ARRAY['inclusion', 'sports'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Together We Thrive', 'together-we-thrive', 'Mental health awareness and support.', 'Service', ARRAY['wellness', 'support'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'World Language Club', 'world-language-club', 'Exploring languages and cultures.', 'Language/Culture', ARRAY['language', 'culture'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Yearbook', 'yearbook', 'School yearbook design and production.', 'Arts', ARRAY['yearbook', 'media'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public')
ON CONFLICT (slug) DO NOTHING;

-- Sample Events (using relative dates would need dynamic SQL; using fixed future dates)
INSERT INTO events (school_id, club_id, title, slug, description, event_type, starts_at, ends_at, location, visibility, status) VALUES
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Science Bowl Intro Meeting', 'science-bowl-intro', 'Welcome meeting for new and returning Science Bowl members.', 'meeting', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour', 'Room TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Science Bowl Subject Draft Night', 'science-bowl-draft', 'Subject team assignments and practice planning.', 'meeting', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2 hours', 'Room TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000002', 'Math Club AMC Prep Session', 'math-club-amc-prep', 'AMC 10/12 preparation with practice problems.', 'workshop', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '1.5 hours', 'Room TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000003', 'Robotics Build Session', 'robotics-build', 'Weekly robot build and testing session.', 'meeting', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '3 hours', 'Shop TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000003', 'Robotics Programming Workshop', 'robotics-programming', 'Intro to robot programming and autonomous routines.', 'workshop', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '2 hours', 'Computer Lab TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Jazz / Music Opportunity Info Session', 'jazz-music-info', 'Learn about band, choir, and music audition opportunities.', 'info_session', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '1 hour', 'Auditorium TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Volunteer Fair', 'volunteer-fair', 'Legacy event retained but hidden because the school uses a separate volunteering system.', 'other', NOW() + INTERVAL '12 days', NOW() + INTERVAL '12 days' + INTERVAL '2 hours', 'Gym TBD', 'public', 'archived'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Club Officer Training', 'officer-training', 'Training session for club officers and leaders.', 'workshop', NOW() + INTERVAL '8 days', NOW() + INTERVAL '8 days' + INTERVAL '1 hour', 'Library TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Freshman Opportunity Night', 'freshman-opportunity-night', 'Overview of clubs, sports, and activities for freshmen.', 'info_session', NOW() + INTERVAL '20 days', NOW() + INTERVAL '20 days' + INTERVAL '2 hours', 'Auditorium TBD', 'public', 'approved')
ON CONFLICT DO NOTHING;

-- Product simplification and summer launch defaults.
-- TODO: Volunteering/service hours disabled because school uses a separate system.
UPDATE clubs
SET status = 'interest_open', is_listed = TRUE, is_featured = TRUE, is_active = TRUE, visibility = 'public'
WHERE slug IN ('science-bowl', 'math-club', 'robotics-club');

UPDATE clubs
SET status = 'draft', is_listed = FALSE, is_featured = FALSE
WHERE slug NOT IN ('science-bowl', 'math-club', 'robotics-club');

-- Sample Opportunities
INSERT INTO opportunities (school_id, club_id, title, slug, summary, description, category, tags, eligibility, grade_min, grade_max, deadline, action_label, status, visibility) VALUES
('a0000000-0000-4000-8000-000000000001', NULL, 'Metro Student Science Fair', 'metro-student-science-fair', 'Present an original science or engineering project to local judges.', 'Register to present an individual or team project at the Metro Student Science Fair.', 'Competition', ARRAY['science', 'research', 'engineering'], 'Open to students in grades 9-12', 9, 12, NOW() + INTERVAL '28 days', 'Register', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Nebraska College Meet and Greet', 'nebraska-college-meet-and-greet', 'Meet admissions representatives from colleges across Nebraska.', 'Learn about programs, scholarships, admissions, and campus life.', 'College', ARRAY['college', 'admissions', 'scholarships'], 'Open to all students and families', 9, 12, NOW() + INTERVAL '18 days', 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Youth Leadership Conference', 'youth-leadership-conference', 'Apply for a one-day student leadership conference.', 'Join students from across the metro for workshops on communication, service, and school leadership.', 'Application', ARRAY['leadership', 'conference'], 'Grades 10-12', 10, 12, NOW() + INTERVAL '21 days', 'Apply', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Peer Tutoring: Chemistry Basics', 'peer-tutoring-chemistry', 'Student-led chemistry tutoring sessions.', 'Get help with stoichiometry, bonding, and basic chemistry concepts from peer tutors.', 'Tutoring', ARRAY['chemistry', 'tutoring'], 'All students', 9, 12, NULL, 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Peer Tutoring: Algebra II / Precalculus', 'peer-tutoring-algebra', 'Problem-solving help for Algebra II and Precalculus.', 'Student tutors available for homework help and exam prep.', 'Tutoring', ARRAY['math', 'algebra', 'tutoring'], 'All students', 9, 12, NULL, 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Music Audition Reminder', 'music-audition-reminder', 'Audition dates for band, choir, and ensembles.', 'Check audition requirements and sign up for your preferred ensemble.', 'Music', ARRAY['music', 'audition'], 'All students', 9, 12, NOW() + INTERVAL '14 days', 'Learn More', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Volunteer Hours Opportunity', 'volunteer-hours', 'Community service opportunities available.', 'Multiple volunteer opportunities for students tracking service hours.', 'Volunteering', ARRAY['service', 'volunteer'], 'All students', 9, 12, NULL, 'View Opportunities', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Research Interest Form', 'research-interest', 'Express interest in student research programs.', 'Submit your research interests to connect with mentors and programs.', 'Research', ARRAY['research', 'STEM'], 'Grades 10-12 recommended', 10, 12, NOW() + INTERVAL '60 days', 'Submit Interest', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Student-Led Workshop Host Application', 'workshop-host-app', 'Apply to host a peer workshop.', 'Share your knowledge by hosting a student-led workshop on StormHub.', 'School Events', ARRAY['workshop', 'leadership'], 'All students', 9, 12, NOW() + INTERVAL '30 days', 'Apply', 'approved', 'public')
ON CONFLICT (slug) DO NOTHING;

UPDATE opportunities
SET status = 'archived'
WHERE category = 'Volunteering' OR slug = 'volunteer-hours';

UPDATE opportunities SET club_id = NULL WHERE club_id IS NOT NULL;
UPDATE opportunities SET status = 'archived' WHERE slug IN ('join-science-bowl', 'join-robotics');
UPDATE opportunities SET category = 'Workshop', action_label = 'Sign Up' WHERE slug IN ('amc-prep-group', 'peer-tutoring-chemistry', 'peer-tutoring-algebra');
UPDATE opportunities SET category = 'Audition', action_label = 'Register' WHERE slug = 'music-audition-reminder';
UPDATE opportunities SET category = 'Interest Form', action_label = 'Sign Up' WHERE slug = 'research-interest';
UPDATE opportunities SET category = 'Application', action_label = 'Apply' WHERE slug = 'workshop-host-app';

-- Sample Workshops
INSERT INTO workshops (school_id, title, description, subject_area, skill_level, starts_at, location, status) VALUES
('a0000000-0000-4000-8000-000000000001', 'Chemistry Basics Tutoring', 'Peer tutoring for stoichiometry and bonding.', 'Chemistry', 'Beginner', NOW() + INTERVAL '4 days', 'Library TBD', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'Algebra II Problem Solving', 'Weekly problem-solving session for Algebra II.', 'Math', 'Intermediate', NOW() + INTERVAL '6 days', 'Room TBD', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'Intro to Python for Robotics', 'Learn Python basics for robot programming.', 'Computer Science', 'Beginner', NOW() + INTERVAL '9 days', 'Computer Lab TBD', 'approved')
ON CONFLICT DO NOTHING;

-- Sample Announcements for featured clubs
INSERT INTO club_announcements (club_id, author_id, title, body, visibility, status, published_at) VALUES
('c0000001-0000-4000-8000-000000000001', NULL, 'Welcome to Science Bowl!', 'Practice schedules will be posted soon. Join to stay updated on tryouts and subject teams.', 'public', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000001', NULL, 'Subject Team Assignments Posted', 'Check the member resources page for your subject team assignment and practice schedule.', 'members', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000002', NULL, 'AMC Registration Open', 'AMC 10/12 registration is now open. See member resources for sign-up links.', 'members', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000003', NULL, 'Build Season Kickoff', 'Build season starts this week! Check the build schedule in member resources.', 'members', 'approved', NOW())
ON CONFLICT DO NOTHING;

-- Member-only club resources (Science Bowl)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000001', NULL, 'Practice Schedule', 'Weekly practice times and locations', 'text', 'Practices TBD — check announcements for updates when school resumes.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Subject Assignments', 'Your subject team assignment', 'text', 'Subject teams will be assigned after tryouts.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Biology Resources', 'Study materials for biology', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Chemistry Resources', 'Study materials for chemistry', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Physics Resources', 'Study materials for physics', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Earth Science Resources', 'Study materials for earth science', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Astronomy Resources', 'Study materials for astronomy', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Math Resources', 'Study materials for math', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Mock Round Guidelines', 'How mock rounds work', 'text', 'Mock rounds follow official Science Bowl rules. Buzz in when you know the answer.', NULL, 'members', 'approved')
ON CONFLICT DO NOTHING;

-- Member-only club resources (Math Club)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000002', NULL, 'AMC/AIME Resources', 'Contest preparation materials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Weekly Problem Set', 'This week problems', 'text', 'Problem set posted weekly — check back Monday.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Contest Calendar', 'Upcoming math contests', 'text', 'AMC 10/12: November | AIME: February | State Math Contest: March', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Topic Groups', 'Study group sign-ups', 'text', 'Algebra, Geometry, Combinatorics, Number Theory, Probability groups forming.', NULL, 'members', 'approved')
ON CONFLICT DO NOTHING;

-- Member-only club resources (Robotics)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000003', NULL, 'Build Schedule', 'Weekly build sessions', 'text', 'Build sessions TBD — see announcements when school resumes.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Programming Resources', 'Code templates and tutorials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'CAD/Design Resources', 'Design files and tutorials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Tournament Preparation', 'Competition checklist', 'text', 'Pre-tournament checklist: robot inspection, autonomous tested, spare parts packed.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Engineering Notebook Resources', 'Notebook templates and guidelines', 'link', NULL, '#', 'members', 'approved')
ON CONFLICT DO NOTHING;
