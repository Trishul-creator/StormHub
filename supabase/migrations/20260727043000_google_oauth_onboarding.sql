-- Let a verified Google identity reach a tightly limited school-selection
-- checkpoint. Email/password signups must still provide and pass a school
-- assignment before the auth user can be created.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
  permitted_domains TEXT[];
  raw_school_id TEXT;
  raw_grade TEXT;
  email_domain TEXT;
  parsed_grade INT;
  is_google_provider BOOLEAN;
BEGIN
  raw_school_id := NEW.raw_user_meta_data->>'school_id';
  is_google_provider :=
    lower(COALESCE(NEW.raw_app_meta_data->>'provider', '')) = 'google'
    OR COALESCE(NEW.raw_app_meta_data->'providers', '[]'::JSONB) ? 'google';

  IF raw_school_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
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
  END IF;

  IF NOT is_google_provider THEN
    RAISE EXCEPTION 'Choose a valid school workspace';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, grade_level,
    account_status, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NEW.email,
      'New user'
    ),
    'student',
    NULL,
    NULL,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
