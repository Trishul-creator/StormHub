-- Add district-level tenancy between the platform and school scopes.
-- Existing super_admin accounts remain the unrestricted platform administrators.

BEGIN;

CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT,
  state TEXT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE RESTRICT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE RESTRICT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'district_admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_schools_district_name
  ON public.schools(district_id, name);
CREATE INDEX IF NOT EXISTS idx_profiles_district_created
  ON public.profiles(district_id, created_at);

-- Verified from Elkhorn Public Schools' own school pages and school profile.
INSERT INTO public.districts (
  id, name, slug, city, state, website_url, is_active
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'Elkhorn Public Schools',
  'elkhorn-public-schools',
  'Elkhorn',
  'NE',
  'https://www.elkhornweb.org',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  website_url = EXCLUDED.website_url,
  is_active = TRUE;

UPDATE public.schools
SET district_id = (
  SELECT id
  FROM public.districts
  WHERE slug = 'elkhorn-public-schools'
)
WHERE slug IN ('elkhorn-south', 'elkhorn-north');

UPDATE public.profiles AS profile
SET district_id = school.district_id
FROM public.schools AS school
WHERE profile.school_id = school.id
  AND profile.district_id IS DISTINCT FROM school.district_id;

UPDATE public.profiles
SET school_id = NULL,
    district_id = NULL
WHERE role = 'super_admin';

CREATE OR REPLACE FUNCTION public.sync_profile_administrative_scope()
RETURNS TRIGGER AS $$
DECLARE
  resolved_district_id UUID;
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.school_id := NULL;
    NEW.district_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role = 'district_admin' THEN
    IF NEW.district_id IS NULL THEN
      RAISE EXCEPTION 'District administrators must be assigned to a district';
    END IF;
    NEW.school_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.school_id IS NOT NULL THEN
    SELECT district_id INTO resolved_district_id
    FROM public.schools
    WHERE id = NEW.school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assigned school was not found';
    END IF;
    NEW.district_id := resolved_district_id;
  ELSE
    NEW.district_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS profiles_sync_administrative_scope ON public.profiles;
CREATE TRIGGER profiles_sync_administrative_scope
  BEFORE INSERT OR UPDATE OF role, school_id, district_id
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_administrative_scope();

CREATE OR REPLACE FUNCTION public.sync_profiles_after_school_district_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.district_id IS DISTINCT FROM OLD.district_id THEN
    UPDATE public.profiles
    SET district_id = NEW.district_id
    WHERE school_id = NEW.id
      AND district_id IS DISTINCT FROM NEW.district_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS schools_sync_profile_districts ON public.schools;
CREATE TRIGGER schools_sync_profile_districts
  AFTER UPDATE OF district_id ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_after_school_district_change();

CREATE OR REPLACE FUNCTION public.current_user_district_id()
RETURNS UUID AS $$
  SELECT district_id
  FROM public.profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_district_admin()
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'district_admin'
      AND district_id IS NOT NULL
      AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_district(district_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
      AND (
        role = 'super_admin'
        OR (role = 'district_admin' AND district_id = district_uuid)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'district_admin', 'super_admin')
      AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_school(school_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles actor
    LEFT JOIN public.schools school ON school.id = school_uuid
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (actor.role = 'district_admin'
          AND actor.district_id IS NOT NULL
          AND actor.district_id = school.district_id)
        OR (actor.role = 'admin' AND actor.school_id = school_uuid)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_admin_club(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_admin_mfa() AND EXISTS (
    SELECT 1
    FROM public.profiles actor
    JOIN public.clubs club ON club.id = club_uuid
    JOIN public.schools school ON school.id = club.school_id
    WHERE actor.id = auth.uid()
      AND actor.account_status = 'active'
      AND (
        actor.role = 'super_admin'
        OR (actor.role = 'district_admin'
          AND actor.district_id IS NOT NULL
          AND actor.district_id = school.district_id)
        OR (actor.role = 'admin' AND actor.school_id = club.school_id)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_approve_content()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
      AND (
        role = 'teacher'
        OR (role IN ('admin', 'district_admin', 'super_admin') AND public.has_admin_mfa())
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

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
    OR NEW.district_id IS DISTINCT FROM OLD.district_id
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Users cannot change protected account fields';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.district_id IS DISTINCT FROM OLD.district_id
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
  THEN
    IF actor.role NOT IN ('admin', 'district_admin', 'super_admin')
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
      RAISE EXCEPTION 'Only a district or platform administrator can modify this account';
    END IF;

    IF actor.role = 'district_admin' AND (
      actor.district_id IS NULL
      OR OLD.district_id IS DISTINCT FROM actor.district_id
      OR NEW.district_id IS DISTINCT FROM actor.district_id
      OR OLD.role NOT IN ('student', 'teacher', 'admin')
      OR NEW.role NOT IN ('student', 'teacher', 'admin')
    ) THEN
      RAISE EXCEPTION 'District administrators can only manage school-level accounts in their district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.mark_profile_role_promotion()
RETURNS TRIGGER AS $$
DECLARE
  old_rank INT;
  new_rank INT;
BEGIN
  old_rank := CASE OLD.role
    WHEN 'student' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'district_admin' THEN 4
    WHEN 'super_admin' THEN 5
    ELSE 0
  END;
  new_rank := CASE NEW.role
    WHEN 'student' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'district_admin' THEN 4
    WHEN 'super_admin' THEN 5
    ELSE 0
  END;
  IF NEW.role IS DISTINCT FROM OLD.role AND new_rank > old_rank THEN
    NEW.onboarding_reset_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.districts TO authenticated;
GRANT ALL ON TABLE public.districts TO service_role;

DROP POLICY IF EXISTS "districts_authenticated_read" ON public.districts;
CREATE POLICY "districts_authenticated_read"
  ON public.districts FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_admin_district(id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.district_id = districts.id
    )
  );

DROP POLICY IF EXISTS "districts_super_admin_write" ON public.districts;
CREATE POLICY "districts_super_admin_write"
  ON public.districts FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "schools_super_admin_write" ON public.schools;
DROP POLICY IF EXISTS "schools_administrative_write" ON public.schools;
CREATE POLICY "schools_administrative_write"
  ON public.schools FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (district_id IS NOT NULL AND public.can_admin_district(district_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (district_id IS NOT NULL AND public.can_admin_district(district_id))
  );

-- Preserve the existing school-admin behavior while allowing a district
-- administrator to manage school-level roles only inside their own district.
CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
  normalized_club_ids UUID[] := COALESCE(assigned_club_ids, ARRAY[]::UUID[]);
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = target_user_id;

  IF actor.role NOT IN ('admin', 'district_admin', 'super_admin')
    OR actor.account_status <> 'active'
    OR NOT public.has_admin_mfa()
  THEN
    RAISE EXCEPTION 'MFA-verified administrator access required';
  END IF;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF actor.role = 'admin' AND (
    actor.school_id IS NULL
    OR target.school_id IS DISTINCT FROM actor.school_id
    OR target.role NOT IN ('student', 'teacher')
    OR new_role NOT IN ('student', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Only a district or platform administrator can modify admin-level accounts';
  END IF;
  IF actor.role = 'district_admin' AND (
    actor.district_id IS NULL
    OR target.district_id IS DISTINCT FROM actor.district_id
    OR target.school_id IS NULL
    OR target.role NOT IN ('student', 'teacher', 'admin')
    OR new_role NOT IN ('student', 'teacher', 'admin')
  ) THEN
    RAISE EXCEPTION 'District administrators can only manage school-level accounts in their district';
  END IF;
  IF new_role = 'teacher' AND EXISTS (
    SELECT 1
    FROM unnest(normalized_club_ids) AS assigned(club_id)
    LEFT JOIN public.clubs c ON c.id = assigned.club_id
    LEFT JOIN public.schools s ON s.id = c.school_id
    WHERE c.id IS NULL
      OR c.school_id IS DISTINCT FROM target.school_id
      OR (actor.role = 'admin' AND c.school_id IS DISTINCT FROM actor.school_id)
      OR (actor.role = 'district_admin' AND s.district_id IS DISTINCT FROM actor.district_id)
      OR c.status NOT IN ('interest_open', 'active')
      OR c.is_active IS NOT TRUE
      OR c.is_listed IS NOT TRUE
      OR c.visibility IS DISTINCT FROM 'public'
  ) THEN
    RAISE EXCEPTION 'Sponsors can only be assigned to published, active clubs in their school';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  UPDATE public.club_memberships
  SET role = 'member', status = 'left'
  WHERE user_id = target_user_id
    AND role = 'sponsor'
    AND (
      new_role <> 'teacher'
      OR NOT (club_id = ANY(normalized_club_ids))
    );

  IF new_role = 'teacher' THEN
    INSERT INTO public.club_memberships (club_id, user_id, status, role)
    SELECT DISTINCT assigned.club_id, target_user_id, 'active', 'sponsor'
    FROM unnest(normalized_club_ids) AS assigned(club_id)
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET status = 'active', role = 'sponsor';
  ELSIF new_role IN ('admin', 'district_admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;

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

  IF actor.role NOT IN ('admin', 'district_admin', 'super_admin')
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
  IF actor.role = 'district_admin' AND (
    actor.district_id IS NULL
    OR target.district_id IS DISTINCT FROM actor.district_id
    OR target.school_id IS NULL
    OR target.role NOT IN ('student', 'teacher', 'admin')
  ) THEN
    RAISE EXCEPTION 'District administrators can only manage school-level accounts in their district';
  END IF;

  UPDATE public.profiles
  SET account_status = new_status
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_account_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_school_signup_domains(
  target_school_id UUID,
  requested_domains TEXT[]
)
RETURNS TEXT[] AS $$
DECLARE
  actor_role TEXT;
  normalized_domains TEXT[];
BEGIN
  IF NOT public.can_admin_school(target_school_id) THEN
    SELECT role INTO actor_role
    FROM public.profiles
    WHERE id = auth.uid();
    IF actor_role = 'admin' THEN
      RAISE EXCEPTION 'School administrators can only update their own school';
    END IF;
    IF actor_role = 'district_admin' THEN
      RAISE EXCEPTION 'District administrators can only update schools in their district';
    END IF;
    RAISE EXCEPTION 'Administrator access required for this school';
  END IF;

  SELECT array_agg(domain ORDER BY domain)
  INTO normalized_domains
  FROM (
    SELECT DISTINCT regexp_replace(lower(trim(value)), '^@', '') AS domain
    FROM unnest(COALESCE(requested_domains, ARRAY[]::TEXT[])) AS item(value)
  ) normalized
  WHERE domain <> '';

  IF COALESCE(cardinality(normalized_domains), 0) = 0 THEN
    RAISE EXCEPTION 'Enter at least one accepted email domain';
  END IF;
  IF '*' = ANY(normalized_domains) AND cardinality(normalized_domains) > 1 THEN
    RAISE EXCEPTION 'Use * by itself to allow every email domain';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_domains) AS domain(value)
    WHERE domain.value <> '*'
      AND domain.value !~ '^[a-z0-9.-]+\.[a-z]{2,}$'
  ) THEN
    RAISE EXCEPTION 'One or more email domains are invalid';
  END IF;

  UPDATE public.schools
  SET allowed_email_domains = normalized_domains
  WHERE id = target_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'School not found'; END IF;

  RETURN normalized_domains;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.set_school_signup_domains(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_school_signup_domains(UUID, TEXT[]) TO authenticated;

-- District-aware aggregate statistics. A district administrator receives only
-- their district totals or a selected school from that district.
DROP FUNCTION IF EXISTS public.get_admin_statistics(UUID);
CREATE OR REPLACE FUNCTION public.get_admin_statistics(
  requested_school_id UUID DEFAULT NULL,
  requested_district_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
  actor_district_id UUID;
  actor_status TEXT;
  effective_school_id UUID;
  effective_district_id UUID;
  result JSONB;
BEGIN
  SELECT role, school_id, district_id, account_status
  INTO actor_role, actor_school_id, actor_district_id, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_status IS DISTINCT FROM 'active'
    OR actor_role NOT IN ('admin', 'district_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF actor_role = 'admin' THEN
    IF actor_school_id IS NULL THEN
      RAISE EXCEPTION 'School administrator account is not assigned to a school';
    END IF;
    IF requested_school_id IS NOT NULL
      AND requested_school_id IS DISTINCT FROM actor_school_id THEN
      RAISE EXCEPTION 'School administrators can only view statistics for their own school';
    END IF;
    effective_school_id := actor_school_id;
    effective_district_id := actor_district_id;
  ELSIF actor_role = 'district_admin' THEN
    IF actor_district_id IS NULL THEN
      RAISE EXCEPTION 'District administrator account is not assigned to a district';
    END IF;
    IF requested_school_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.schools
      WHERE id = requested_school_id
        AND district_id = actor_district_id
    ) THEN
      RAISE EXCEPTION 'District administrators can only view schools in their district';
    END IF;
    effective_school_id := requested_school_id;
    effective_district_id := actor_district_id;
  ELSE
    effective_school_id := requested_school_id;
    effective_district_id := requested_district_id;
  END IF;

  IF effective_district_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.districts WHERE id = effective_district_id
    ) THEN
    RAISE EXCEPTION 'District not found';
  END IF;

  IF effective_school_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.schools
      WHERE id = effective_school_id
        AND (
          effective_district_id IS NULL
          OR district_id = effective_district_id
        )
    ) THEN
    RAISE EXCEPTION 'School not found in the selected district';
  END IF;

  WITH
  scoped_people AS (
    SELECT p.id, p.role, p.account_status, p.created_at
    FROM public.profiles p
    WHERE
      (effective_school_id IS NOT NULL AND p.school_id = effective_school_id)
      OR (
        effective_school_id IS NULL
        AND (effective_district_id IS NULL OR p.district_id = effective_district_id)
      )
  ),
  scoped_clubs AS (
    SELECT c.id, c.name, c.slug, c.status, c.is_active, c.updated_at
    FROM public.clubs c
    JOIN public.schools s ON s.id = c.school_id
    WHERE
      (effective_school_id IS NOT NULL AND c.school_id = effective_school_id)
      OR (
        effective_school_id IS NULL
        AND (effective_district_id IS NULL OR s.district_id = effective_district_id)
      )
  ),
  scoped_memberships AS (
    SELECT m.club_id, m.user_id, m.role, m.status, m.joined_at
    FROM public.club_memberships m
    JOIN scoped_clubs c ON c.id = m.club_id
    JOIN scoped_people p ON p.id = m.user_id
  ),
  scoped_events AS (
    SELECT e.id, e.club_id, e.status, e.starts_at, e.created_at
    FROM public.events e
    JOIN public.schools s ON s.id = e.school_id
    WHERE
      (effective_school_id IS NOT NULL AND e.school_id = effective_school_id)
      OR (
        effective_school_id IS NULL
        AND (effective_district_id IS NULL OR s.district_id = effective_district_id)
      )
  ),
  scoped_analytics AS (
    SELECT a.user_id, a.entity_type, a.entity_id, a.created_at
    FROM public.analytics_events a
    JOIN public.schools s ON s.id = a.school_id
    WHERE
      (effective_school_id IS NOT NULL AND a.school_id = effective_school_id)
      OR (
        effective_school_id IS NULL
        AND (effective_district_id IS NULL OR s.district_id = effective_district_id)
      )
  ),
  engaged_user_ids AS (
    SELECT a.user_id
    FROM scoped_analytics a
    WHERE a.user_id IS NOT NULL
      AND a.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT m.user_id
    FROM scoped_memberships m
    WHERE m.joined_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT r.user_id
    FROM public.event_rsvps r
    JOIN scoped_people p ON p.id = r.user_id
    WHERE r.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT b.user_id
    FROM public.bookmarks b
    JOIN scoped_people p ON p.id = b.user_id
    WHERE b.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT s.student_id
    FROM public.club_assignment_submissions s
    JOIN scoped_people p ON p.id = s.student_id
    WHERE COALESCE(s.submitted_at, s.updated_at, s.created_at) >= NOW() - INTERVAL '30 days'
  ),
  role_rows AS (
    SELECT role, COUNT(*) AS count
    FROM scoped_people
    GROUP BY role
  ),
  club_statuses(status, sort_order) AS (
    VALUES
      ('active'::TEXT, 1),
      ('interest_open'::TEXT, 2),
      ('draft'::TEXT, 3),
      ('paused'::TEXT, 4),
      ('archived'::TEXT, 5)
  ),
  club_status_rows AS (
    SELECT s.status, s.sort_order, COUNT(c.id) AS count
    FROM club_statuses s
    LEFT JOIN scoped_clubs c ON c.status = s.status
    GROUP BY s.status, s.sort_order
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - INTERVAL '5 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS month_start
  ),
  monthly_rows AS (
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month,
      (
        SELECT COUNT(*)
        FROM scoped_people p
        WHERE p.created_at >= m.month_start
          AND p.created_at < m.month_start + INTERVAL '1 month'
      ) AS new_people,
      (
        SELECT COUNT(*)
        FROM scoped_memberships cm
        WHERE cm.joined_at >= m.month_start
          AND cm.joined_at < m.month_start + INTERVAL '1 month'
          AND cm.status = 'active'
          AND cm.role <> 'sponsor'
      ) AS new_memberships,
      (
        SELECT COUNT(*)
        FROM scoped_analytics a
        WHERE a.created_at >= m.month_start
          AND a.created_at < m.month_start + INTERVAL '1 month'
      ) AS engagement_events
    FROM months m
  ),
  top_club_rows AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.status,
      (
        SELECT COUNT(*)
        FROM scoped_memberships m
        WHERE m.club_id = c.id
          AND m.status = 'active'
          AND m.role <> 'sponsor'
      ) AS members,
      (
        SELECT COUNT(*)
        FROM scoped_events e
        WHERE e.club_id = c.id
          AND e.status = 'approved'
          AND e.starts_at >= NOW() - INTERVAL '30 days'
      ) AS recent_events,
      (
        SELECT COUNT(*)
        FROM scoped_analytics a
        WHERE a.entity_type = 'club'
          AND a.entity_id = c.id
          AND a.created_at >= NOW() - INTERVAL '30 days'
      ) AS recent_activity
    FROM scoped_clubs c
    WHERE c.status IN ('active', 'interest_open')
      AND c.is_active IS DISTINCT FROM FALSE
  ),
  ranked_clubs AS (
    SELECT
      t.*,
      (t.members + (t.recent_events * 3) + t.recent_activity) AS score
    FROM top_club_rows t
    ORDER BY score DESC, members DESC, name
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'scopeSchoolId', effective_school_id,
    'scopeDistrictId', effective_district_id,
    'totalPeople', (SELECT COUNT(*) FROM scoped_people),
    'activePeople', (
      SELECT COUNT(*) FROM scoped_people WHERE account_status = 'active'
    ),
    'engagedPeople30d', (
      SELECT COUNT(DISTINCT e.user_id)
      FROM engaged_user_ids e
      JOIN scoped_people p ON p.id = e.user_id
      WHERE p.account_status = 'active'
    ),
    'newPeople30d', (
      SELECT COUNT(*)
      FROM scoped_people
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'totalClubs', (SELECT COUNT(*) FROM scoped_clubs),
    'activeClubs', (
      SELECT COUNT(*)
      FROM scoped_clubs
      WHERE status = 'active' AND is_active IS DISTINCT FROM FALSE
    ),
    'activeMemberships', (
      SELECT COUNT(*)
      FROM scoped_memberships
      WHERE status = 'active' AND role <> 'sponsor'
    ),
    'upcomingEvents', (
      SELECT COUNT(*)
      FROM scoped_events
      WHERE status = 'approved' AND starts_at >= NOW()
    ),
    'engagementEvents30d', (
      SELECT COUNT(*)
      FROM scoped_analytics
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'roleDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('role', role, 'count', count)
        ORDER BY count DESC, role
      )
      FROM role_rows
    ), '[]'::JSONB),
    'clubStatusDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('status', status, 'count', count)
        ORDER BY sort_order
      )
      FROM club_status_rows
    ), '[]'::JSONB),
    'monthlyActivity', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'month', month,
          'newPeople', new_people,
          'newMemberships', new_memberships,
          'engagementEvents', engagement_events
        )
        ORDER BY month
      )
      FROM monthly_rows
    ), '[]'::JSONB),
    'topClubs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'slug', slug,
          'status', status,
          'members', members,
          'recentEvents', recent_events,
          'recentActivity', recent_activity,
          'score', score
        )
        ORDER BY score DESC, members DESC, name
      )
      FROM ranked_clubs
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_statistics(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_statistics(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.districts IS
  'District-level tenant between platform administration and school workspaces.';
COMMENT ON COLUMN public.schools.district_id IS
  'Owning district. Null is allowed for independent schools.';
COMMENT ON COLUMN public.profiles.district_id IS
  'District scope for district administrators and a denormalized school-district scope for other users.';

COMMIT;
