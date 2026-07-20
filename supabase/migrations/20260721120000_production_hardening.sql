-- Production hardening for account lifecycle, MFA-gated administration,
-- school-domain signup enforcement, immutable audit history, and durable jobs.

BEGIN;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS graduation_year INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'deactivated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_graduation_year_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_graduation_year_check
      CHECK (graduation_year IS NULL OR graduation_year BETWEEN 2000 AND 2200);
  END IF;
END $$;

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

INSERT INTO public.school_settings (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_requests_pending
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_school_status
  ON public.account_deletion_requests(school_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB NOT NULL DEFAULT '{}',
  new_data JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_school_occurred
  ON public.admin_audit_log(school_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_occurred
  ON public.admin_audit_log(actor_user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.digest_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'queued', 'sent', 'failed', 'skipped')),
  email_outbox_id UUID REFERENCES public.email_outbox(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_digest_deliveries_period_status
  ON public.digest_deliveries(period_start, status);

CREATE OR REPLACE FUNCTION public.claim_digest_delivery(
  target_user_id UUID,
  target_school_id UUID,
  target_period_start DATE
)
RETURNS TABLE(id UUID) AS $$
  INSERT INTO public.digest_deliveries (user_id, school_id, period_start, status)
  VALUES (target_user_id, target_school_id, target_period_start, 'processing')
  ON CONFLICT (user_id, period_start) DO UPDATE
    SET status = 'processing',
        error_message = NULL,
        completed_at = NULL
    WHERE public.digest_deliveries.status = 'failed'
  RETURNING public.digest_deliveries.id;
$$ LANGUAGE sql SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_digest_delivery(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_digest_delivery(UUID, UUID, DATE) TO service_role;

CREATE TABLE IF NOT EXISTS public.request_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  was_successful BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_attempts_type_actor_created
  ON public.request_attempts(request_type, actor_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_admin_mfa()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NULL OR COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$ LANGUAGE sql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_school(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
      AND (
        role = 'super_admin'
        OR (role = 'admin' AND school_id = school_uuid)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.clubs c ON c.id = club_uuid
    WHERE p.id = auth.uid()
      AND p.account_status = 'active'
      AND (
        p.role = 'super_admin'
        OR (p.role = 'admin' AND p.school_id = c.school_id)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_approve_content()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
      AND (
        role = 'teacher'
        OR (role IN ('admin', 'super_admin') AND public.has_admin_mfa())
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_member(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND p.account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid) OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND p.account_status = 'active'
      AND (
        (p.role = 'student' AND m.role IN ('officer', 'president'))
        OR (p.role = 'teacher' AND m.role = 'sponsor')
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_club_roster(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_admin_club(club_uuid) OR EXISTS (
    SELECT 1
    FROM public.club_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.club_id = club_uuid
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND p.account_status = 'active'
      AND p.role = 'teacher'
      AND m.role = 'sponsor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
  permitted_domains TEXT[];
  raw_school_id TEXT;
  raw_grade TEXT;
  email_domain TEXT;
  parsed_grade INT;
BEGIN
  raw_school_id := NEW.raw_user_meta_data->>'school_id';
  IF raw_school_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Choose a valid school workspace';
  END IF;

  SELECT id, allowed_email_domains
  INTO target_school_id, permitted_domains
  FROM public.schools
  WHERE id = raw_school_id::UUID
    AND is_active = TRUE
    AND is_public = TRUE
  LIMIT 1;

  IF target_school_id IS NULL THEN
    RAISE EXCEPTION 'Choose an active school workspace';
  END IF;

  IF COALESCE(cardinality(permitted_domains), 0) = 0 THEN
    RAISE EXCEPTION 'Signups are not configured for this school';
  END IF;

  email_domain := lower(split_part(COALESCE(NEW.email, ''), '@', 2));
  IF NOT EXISTS (
    SELECT 1 FROM unnest(permitted_domains) AS domain(value)
    WHERE lower(trim(domain.value)) = email_domain
  ) THEN
    RAISE EXCEPTION 'Use an approved school email address';
  END IF;

  raw_grade := NEW.raw_user_meta_data->>'grade_level';
  IF raw_grade ~ '^[0-9]+$' THEN
    parsed_grade := raw_grade::INT;
  END IF;
  IF parsed_grade NOT BETWEEN 9 AND 12 THEN
    parsed_grade := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, grade_level,
    account_status, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'New user'),
    'student',
    target_school_id,
    parsed_grade,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  actor public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();

  IF auth.uid() = OLD.id AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Users cannot change protected account fields';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
  THEN
    IF actor.role NOT IN ('admin', 'super_admin')
      OR actor.account_status <> 'active'
      OR NOT public.has_admin_mfa()
    THEN
      RAISE EXCEPTION 'MFA-verified administrator access required';
    END IF;

    IF actor.role = 'admin' AND (
      actor.school_id IS NULL
      OR OLD.school_id IS DISTINCT FROM actor.school_id
      OR NEW.school_id IS DISTINCT FROM actor.school_id
      OR OLD.role NOT IN ('student', 'teacher')
      OR NEW.role NOT IN ('student', 'teacher')
    ) THEN
      RAISE EXCEPTION 'Only a super admin can modify this account';
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
  actor_status TEXT;
  content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT role, account_status
  INTO actor_role, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_status <> 'active' THEN
    RAISE EXCEPTION 'Active account required';
  END IF;

  content_club_id := NEW.club_id;
  IF actor_role IN ('admin', 'super_admin') AND public.has_admin_mfa() THEN
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

  RAISE EXCEPTION 'This content requires an authorized approver';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  target_user_id UUID,
  new_status TEXT
)
RETURNS VOID AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = target_user_id;

  IF actor.role NOT IN ('admin', 'super_admin')
    OR actor.account_status <> 'active'
    OR NOT public.has_admin_mfa()
  THEN
    RAISE EXCEPTION 'MFA-verified administrator access required';
  END IF;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own status'; END IF;
  IF new_status NOT IN ('active', 'suspended', 'deactivated') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;
  IF actor.role = 'admin' AND (
    actor.school_id IS NULL
    OR target.school_id IS DISTINCT FROM actor.school_id
    OR target.role NOT IN ('student', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Only a super admin can modify this account';
  END IF;

  UPDATE public.profiles
  SET account_status = new_status
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_account_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = target_user_id;

  IF actor.role NOT IN ('admin', 'super_admin')
    OR actor.account_status <> 'active'
    OR NOT public.has_admin_mfa()
  THEN
    RAISE EXCEPTION 'MFA-verified administrator access required';
  END IF;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF actor.role = 'admin' AND (
    actor.school_id IS NULL
    OR target.school_id IS DISTINCT FROM actor.school_id
    OR target.role NOT IN ('student', 'teacher')
    OR new_role NOT IN ('student', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Only a super admin can modify admin-level accounts';
  END IF;
  IF new_role = 'teacher' AND COALESCE(cardinality(assigned_club_ids), 0) = 0 THEN
    RAISE EXCEPTION 'A teacher must be assigned to at least one club';
  END IF;
  IF new_role = 'teacher' AND EXISTS (
    SELECT 1
    FROM unnest(assigned_club_ids) AS assigned(club_id)
    LEFT JOIN public.clubs c ON c.id = assigned.club_id
    WHERE c.id IS NULL
      OR c.school_id IS DISTINCT FROM target.school_id
      OR (actor.role = 'admin' AND c.school_id IS DISTINCT FROM actor.school_id)
  ) THEN
    RAISE EXCEPTION 'Teacher club assignments must belong to the target school';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  UPDATE public.club_memberships
  SET role = 'member', status = 'left'
  WHERE user_id = target_user_id
    AND role = 'sponsor'
    AND (new_role <> 'teacher' OR NOT (club_id = ANY(assigned_club_ids)));

  IF new_role = 'teacher' THEN
    INSERT INTO public.club_memberships (club_id, user_id, status, role)
    SELECT assigned.club_id, target_user_id, 'active', 'sponsor'
    FROM unnest(assigned_club_ids) AS assigned(club_id)
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET status = 'active', role = 'sponsor';
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS TRIGGER AS $$
DECLARE
  old_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN '{}'::JSONB ELSE to_jsonb(OLD) END;
  new_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN '{}'::JSONB ELSE to_jsonb(NEW) END;
  source_row JSONB;
  resolved_entity_id UUID;
  resolved_school_id UUID;
BEGIN
  source_row := CASE WHEN TG_OP = 'DELETE' THEN old_row ELSE new_row END;
  resolved_entity_id := NULLIF(source_row->>'id', '')::UUID;
  resolved_school_id := NULLIF(source_row->>'school_id', '')::UUID;

  IF TG_TABLE_NAME = 'schools' THEN
    resolved_school_id := resolved_entity_id;
  ELSIF TG_TABLE_NAME = 'school_settings' THEN
    resolved_school_id := NULLIF(source_row->>'school_id', '')::UUID;
    resolved_entity_id := resolved_school_id;
  ELSIF TG_TABLE_NAME = 'club_memberships' THEN
    SELECT school_id INTO resolved_school_id
    FROM public.clubs
    WHERE id = NULLIF(source_row->>'club_id', '')::UUID;
  ELSIF TG_TABLE_NAME IN ('club_announcements', 'club_resources') THEN
    SELECT school_id INTO resolved_school_id
    FROM public.clubs
    WHERE id = NULLIF(source_row->>'club_id', '')::UUID;
  END IF;

  old_row := old_row - ARRAY[
    'email', 'full_name', 'avatar_url', 'body', 'message', 'description',
    'long_description', 'content', 'reason', 'reviewer_notes', 'recipient_email'
  ];
  new_row := new_row - ARRAY[
    'email', 'full_name', 'avatar_url', 'body', 'message', 'description',
    'long_description', 'content', 'reason', 'reviewer_notes', 'recipient_email'
  ];

  INSERT INTO public.admin_audit_log (
    school_id, actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    resolved_school_id,
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    resolved_entity_id,
    old_row,
    new_row
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_audit_admin_update ON public.profiles;
CREATE TRIGGER profiles_audit_admin_update
  AFTER UPDATE OF role, school_id, account_status, grade_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS profiles_audit_delete ON public.profiles;
CREATE TRIGGER profiles_audit_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP TRIGGER IF EXISTS memberships_audit_admin_change ON public.club_memberships;
CREATE TRIGGER memberships_audit_admin_change
  AFTER INSERT OR UPDATE OR DELETE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP TRIGGER IF EXISTS schools_audit_admin_change ON public.schools;
CREATE TRIGGER schools_audit_admin_change
  AFTER INSERT OR UPDATE OR DELETE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP TRIGGER IF EXISTS school_settings_audit_admin_change ON public.school_settings;
CREATE TRIGGER school_settings_audit_admin_change
  AFTER INSERT OR UPDATE OR DELETE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP TRIGGER IF EXISTS approvals_audit_admin_change ON public.approval_requests;
CREATE TRIGGER approvals_audit_admin_change
  AFTER UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP TRIGGER IF EXISTS announcements_audit_delete ON public.club_announcements;
CREATE TRIGGER announcements_audit_delete
  AFTER DELETE ON public.club_announcements
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS resources_audit_delete ON public.club_resources;
CREATE TRIGGER resources_audit_delete
  AFTER DELETE ON public.club_resources
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS opportunities_audit_delete ON public.opportunities;
CREATE TRIGGER opportunities_audit_delete
  AFTER DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS events_audit_delete ON public.events;
CREATE TRIGGER events_audit_delete
  AFTER DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS account_deletion_requests_audit ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_audit
  AFTER UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.account_deletion_requests TO authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.account_deletion_requests, public.admin_audit_log,
  public.digest_deliveries, public.request_attempts TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON TABLE public.signup_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE public.request_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE public.digest_deliveries FROM anon, authenticated;
REVOKE INSERT ON TABLE public.feedback FROM anon, authenticated;
REVOKE INSERT ON TABLE public.interest_forms FROM anon, authenticated;

DROP POLICY IF EXISTS "feedback_insert" ON public.feedback;
DROP POLICY IF EXISTS "interest_forms_insert" ON public.interest_forms;

DROP POLICY IF EXISTS "schools_super_admin_write" ON public.schools;
CREATE POLICY "schools_super_admin_write" ON public.schools FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid() AND account_status = 'active')
  WITH CHECK (id = auth.uid() AND account_status = 'active');

DROP POLICY IF EXISTS "school_settings_read" ON public.school_settings;
CREATE POLICY "school_settings_read" ON public.school_settings FOR SELECT
  USING (TRUE);
DROP POLICY IF EXISTS "school_settings_admin_manage" ON public.school_settings;
CREATE POLICY "school_settings_admin_manage" ON public.school_settings FOR ALL
  USING (public.can_admin_school(school_id))
  WITH CHECK (public.can_admin_school(school_id));

DROP POLICY IF EXISTS "deletion_requests_read" ON public.account_deletion_requests;
CREATE POLICY "deletion_requests_read" ON public.account_deletion_requests FOR SELECT
  USING (user_id = auth.uid() OR public.can_admin_school(school_id));
DROP POLICY IF EXISTS "deletion_requests_insert_own" ON public.account_deletion_requests;
CREATE POLICY "deletion_requests_insert_own" ON public.account_deletion_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND school_id IS NOT DISTINCT FROM public.current_user_school_id()
    AND public.is_active_user()
  );
DROP POLICY IF EXISTS "deletion_requests_admin_update" ON public.account_deletion_requests;
CREATE POLICY "deletion_requests_admin_update" ON public.account_deletion_requests FOR UPDATE
  USING (public.can_admin_school(school_id))
  WITH CHECK (public.can_admin_school(school_id));

DROP POLICY IF EXISTS "admin_audit_log_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_read" ON public.admin_audit_log FOR SELECT
  USING (
    public.is_super_admin()
    OR (school_id IS NOT NULL AND public.can_admin_school(school_id))
  );

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'clubs', 'club_memberships', 'club_announcements', 'club_resources',
    'opportunities', 'events', 'event_rsvps', 'bookmarks', 'workshops',
    'service_hours', 'approval_requests', 'analytics_events',
    'notifications', 'notification_preferences', 'email_outbox'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "active_authenticated_account" ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY "active_authenticated_account" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user())',
      target_table
    );
  END LOOP;
END $$;

COMMIT;
