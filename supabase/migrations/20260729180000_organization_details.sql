-- Add field-limited organization editing after the district hierarchy rollout.
-- This is a forward migration so installations that already applied the
-- district foundation still receive the editing functions.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_district_details(
  target_district_id UUID,
  requested_name TEXT,
  requested_city TEXT DEFAULT NULL,
  requested_state TEXT DEFAULT NULL,
  requested_website_url TEXT DEFAULT NULL,
  requested_slug TEXT DEFAULT NULL,
  requested_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  existing public.districts%ROWTYPE;
  normalized_name TEXT := trim(COALESCE(requested_name, ''));
  normalized_city TEXT := NULLIF(trim(COALESCE(requested_city, '')), '');
  normalized_state TEXT := NULLIF(trim(COALESCE(requested_state, '')), '');
  normalized_website_url TEXT := NULLIF(trim(COALESCE(requested_website_url, '')), '');
  normalized_slug TEXT := NULLIF(lower(trim(COALESCE(requested_slug, ''))), '');
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO existing FROM public.districts WHERE id = target_district_id;

  IF existing.id IS NULL THEN RAISE EXCEPTION 'District not found'; END IF;
  IF actor.account_status IS DISTINCT FROM 'active'
    OR actor.role NOT IN ('district_admin', 'super_admin')
    OR (actor.role = 'district_admin' AND actor.district_id IS DISTINCT FROM target_district_id)
  THEN
    RAISE EXCEPTION 'Administrator access required for this district';
  END IF;
  IF normalized_name = '' THEN RAISE EXCEPTION 'District name is required'; END IF;
  IF length(normalized_state) = 2 THEN normalized_state := upper(normalized_state); END IF;
  IF normalized_state IS NOT NULL AND normalized_state !~ '^[A-Za-z][A-Za-z .-]{1,49}$' THEN
    RAISE EXCEPTION 'State must use a two-letter abbreviation or full name';
  END IF;
  IF normalized_website_url IS NOT NULL
    AND normalized_website_url !~* '^https?://[^[:space:]]+$'
  THEN
    RAISE EXCEPTION 'District website must be a complete http or https URL';
  END IF;

  IF actor.role = 'super_admin' THEN
    normalized_slug := COALESCE(normalized_slug, existing.slug);
    IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'District URL name may contain lowercase letters, numbers, and single hyphens';
    END IF;
  ELSIF requested_slug IS NOT NULL OR requested_is_active IS NOT NULL THEN
    RAISE EXCEPTION 'Only platform administrators can change district routing or availability';
  END IF;

  UPDATE public.districts
  SET name = normalized_name,
      city = normalized_city,
      state = normalized_state,
      website_url = normalized_website_url,
      slug = CASE WHEN actor.role = 'super_admin' THEN normalized_slug ELSE existing.slug END,
      is_active = CASE
        WHEN actor.role = 'super_admin' THEN COALESCE(requested_is_active, existing.is_active)
        ELSE existing.is_active
      END,
      updated_at = NOW()
  WHERE id = target_district_id
  RETURNING * INTO existing;

  RETURN jsonb_build_object(
    'id', existing.id,
    'name', existing.name,
    'slug', existing.slug,
    'isActive', existing.is_active
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.update_district_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_district_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_school_details(
  target_school_id UUID,
  requested_name TEXT,
  requested_short_name TEXT DEFAULT NULL,
  requested_address TEXT DEFAULT NULL,
  requested_city TEXT DEFAULT NULL,
  requested_state TEXT DEFAULT NULL,
  requested_zip TEXT DEFAULT NULL,
  requested_website_url TEXT DEFAULT NULL,
  requested_logo_url TEXT DEFAULT NULL,
  requested_mascot TEXT DEFAULT NULL,
  requested_primary_color TEXT DEFAULT NULL,
  requested_secondary_color TEXT DEFAULT NULL,
  requested_slug TEXT DEFAULT NULL,
  requested_is_active BOOLEAN DEFAULT NULL,
  requested_is_public BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  existing public.schools%ROWTYPE;
  normalized_name TEXT := trim(COALESCE(requested_name, ''));
  normalized_state TEXT := NULLIF(trim(COALESCE(requested_state, '')), '');
  normalized_website_url TEXT := NULLIF(trim(COALESCE(requested_website_url, '')), '');
  normalized_logo_url TEXT := NULLIF(trim(COALESCE(requested_logo_url, '')), '');
  normalized_primary_color TEXT := NULLIF(upper(trim(COALESCE(requested_primary_color, ''))), '');
  normalized_secondary_color TEXT := NULLIF(upper(trim(COALESCE(requested_secondary_color, ''))), '');
  normalized_slug TEXT := NULLIF(lower(trim(COALESCE(requested_slug, ''))), '');
  can_control_workspace BOOLEAN;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO existing FROM public.schools WHERE id = target_school_id;

  IF existing.id IS NULL THEN RAISE EXCEPTION 'School not found'; END IF;
  IF actor.account_status IS DISTINCT FROM 'active'
    OR actor.role NOT IN ('admin', 'district_admin', 'super_admin')
    OR (actor.role = 'admin' AND actor.school_id IS DISTINCT FROM target_school_id)
    OR (actor.role = 'district_admin' AND (
      actor.district_id IS NULL
      OR actor.district_id IS DISTINCT FROM existing.district_id
    ))
  THEN
    RAISE EXCEPTION 'Administrator access required for this school';
  END IF;

  can_control_workspace := actor.role IN ('district_admin', 'super_admin');
  IF normalized_name = '' THEN RAISE EXCEPTION 'School name is required'; END IF;
  IF length(normalized_state) = 2 THEN normalized_state := upper(normalized_state); END IF;
  IF normalized_state IS NOT NULL AND normalized_state !~ '^[A-Za-z][A-Za-z .-]{1,49}$' THEN
    RAISE EXCEPTION 'State must use a two-letter abbreviation or full name';
  END IF;
  IF normalized_website_url IS NOT NULL
    AND normalized_website_url !~* '^https?://[^[:space:]]+$'
  THEN
    RAISE EXCEPTION 'School website must be a complete http or https URL';
  END IF;
  IF normalized_logo_url IS NOT NULL
    AND normalized_logo_url !~* '^https?://[^[:space:]]+$'
  THEN
    RAISE EXCEPTION 'School logo must be a complete http or https URL';
  END IF;
  IF normalized_primary_color IS NOT NULL
    AND normalized_primary_color !~ '^#[0-9A-F]{6}$'
  THEN
    RAISE EXCEPTION 'Primary color must be a six-digit hex color';
  END IF;
  IF normalized_secondary_color IS NOT NULL
    AND normalized_secondary_color !~ '^#[0-9A-F]{6}$'
  THEN
    RAISE EXCEPTION 'Secondary color must be a six-digit hex color';
  END IF;

  IF can_control_workspace THEN
    normalized_slug := COALESCE(normalized_slug, existing.slug);
    IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'School URL name may contain lowercase letters, numbers, and single hyphens';
    END IF;
  ELSIF requested_slug IS NOT NULL
    OR requested_is_active IS NOT NULL
    OR requested_is_public IS NOT NULL
  THEN
    RAISE EXCEPTION 'Only district or platform administrators can change school routing or availability';
  END IF;

  UPDATE public.schools
  SET name = normalized_name,
      short_name = NULLIF(trim(COALESCE(requested_short_name, '')), ''),
      address = NULLIF(trim(COALESCE(requested_address, '')), ''),
      city = NULLIF(trim(COALESCE(requested_city, '')), ''),
      state = normalized_state,
      zip = NULLIF(trim(COALESCE(requested_zip, '')), ''),
      website_url = normalized_website_url,
      logo_url = normalized_logo_url,
      mascot = NULLIF(trim(COALESCE(requested_mascot, '')), ''),
      primary_color = normalized_primary_color,
      secondary_color = normalized_secondary_color,
      slug = CASE WHEN can_control_workspace THEN normalized_slug ELSE existing.slug END,
      is_active = CASE
        WHEN can_control_workspace THEN COALESCE(requested_is_active, existing.is_active)
        ELSE existing.is_active
      END,
      is_public = CASE
        WHEN can_control_workspace THEN COALESCE(requested_is_public, existing.is_public)
        ELSE existing.is_public
      END
  WHERE id = target_school_id
  RETURNING * INTO existing;

  RETURN jsonb_build_object(
    'id', existing.id,
    'name', existing.name,
    'slug', existing.slug,
    'isActive', existing.is_active,
    'isPublic', existing.is_public
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.update_school_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_school_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) TO authenticated;

COMMIT;
