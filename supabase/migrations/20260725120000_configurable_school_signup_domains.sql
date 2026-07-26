-- Allow explicitly open school signup domains and let authorized administrators
-- manage each school's accepted email domains through a narrow audited RPC.

BEGIN;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[] NOT NULL DEFAULT '{}';

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
    SELECT 1
    FROM unnest(permitted_domains) AS domain(value)
    WHERE trim(domain.value) = '*'
      OR lower(trim(domain.value)) = email_domain
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

CREATE OR REPLACE FUNCTION public.set_school_signup_domains(
  target_school_id UUID,
  requested_domains TEXT[]
)
RETURNS TEXT[] AS $$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
  actor_status TEXT;
  normalized_domains TEXT[];
BEGIN
  SELECT role, school_id, account_status
  INTO actor_role, actor_school_id, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_role IS NULL OR actor_status <> 'active' THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF actor_role = 'admin' AND actor_school_id IS DISTINCT FROM target_school_id THEN
    RAISE EXCEPTION 'School administrators can only update their own school';
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  RETURN normalized_domains;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.set_school_signup_domains(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_school_signup_domains(UUID, TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.set_school_signup_domains(UUID, TEXT[]) IS
  'Lets active school admins update their own signup domains and super admins update any school. Use * to accept every domain.';

UPDATE public.schools
SET allowed_email_domains = ARRAY['*']
WHERE slug IN ('elkhorn-south', 'elkhorn-north', 'lexington-east');

COMMIT;
