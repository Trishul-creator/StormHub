-- Require a fresh password, OAuth, SSO, or MFA authentication method before
-- high-impact administrator mutations. The AMR timestamp survives ordinary
-- access-token refreshes, so a refresh does not silently become step-up auth.

BEGIN;

CREATE OR REPLACE FUNCTION public.has_recent_admin_authentication(
  maximum_age_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(auth.jwt() -> 'amr', '[]'::JSONB)) = 'array'
            THEN COALESCE(auth.jwt() -> 'amr', '[]'::JSONB)
          ELSE '[]'::JSONB
        END
      ) AS method_reference
      WHERE method_reference ->> 'method' IN ('password', 'oauth', 'totp', 'sso/saml')
        AND method_reference ->> 'timestamp' ~ '^[0-9]+$'
        AND (method_reference ->> 'timestamp')::BIGINT
          BETWEEN EXTRACT(EPOCH FROM NOW())::BIGINT - GREATEST(maximum_age_seconds, 0)
              AND EXTRACT(EPOCH FROM NOW())::BIGINT + 30
    );
$$;

REVOKE ALL ON FUNCTION public.has_recent_admin_authentication(INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_recent_admin_authentication(INTEGER)
  TO authenticated, service_role;

ALTER FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[])
  RENAME TO admin_set_user_role_and_clubs_before_step_up;
REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs_before_step_up(UUID, TEXT, UUID[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  PERFORM public.admin_set_user_role_and_clubs_before_step_up(
    target_user_id,
    new_role,
    assigned_club_ids
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[])
  TO authenticated;

ALTER FUNCTION public.admin_set_account_status(UUID, TEXT)
  RENAME TO admin_set_account_status_before_step_up;
REVOKE ALL ON FUNCTION public.admin_set_account_status_before_step_up(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_set_account_status(
  target_user_id UUID,
  new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  PERFORM public.admin_set_account_status_before_step_up(target_user_id, new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT)
  TO authenticated;

ALTER FUNCTION public.assign_district_administrator(UUID, UUID)
  RENAME TO assign_district_administrator_before_step_up;
REVOKE ALL ON FUNCTION public.assign_district_administrator_before_step_up(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.assign_district_administrator(
  target_user_id UUID,
  target_district_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  RETURN public.assign_district_administrator_before_step_up(
    target_user_id,
    target_district_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.assign_district_administrator(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_district_administrator(UUID, UUID)
  TO authenticated;

ALTER FUNCTION public.set_school_signup_domains(UUID, TEXT[])
  RENAME TO set_school_signup_domains_before_step_up;
REVOKE ALL ON FUNCTION public.set_school_signup_domains_before_step_up(UUID, TEXT[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.set_school_signup_domains(
  target_school_id UUID,
  requested_domains TEXT[]
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  RETURN public.set_school_signup_domains_before_step_up(
    target_school_id,
    requested_domains
  );
END;
$$;
REVOKE ALL ON FUNCTION public.set_school_signup_domains(UUID, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_signup_domains(UUID, TEXT[])
  TO authenticated;

ALTER FUNCTION public.update_district_details(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)
  RENAME TO update_district_details_before_step_up;
REVOKE ALL ON FUNCTION public.update_district_details_before_step_up(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.update_district_details(
  target_district_id UUID,
  requested_name TEXT,
  requested_city TEXT DEFAULT NULL,
  requested_state TEXT DEFAULT NULL,
  requested_website_url TEXT DEFAULT NULL,
  requested_slug TEXT DEFAULT NULL,
  requested_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  RETURN public.update_district_details_before_step_up(
    target_district_id,
    requested_name,
    requested_city,
    requested_state,
    requested_website_url,
    requested_slug,
    requested_is_active
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_district_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_district_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

ALTER FUNCTION public.update_school_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) RENAME TO update_school_details_before_step_up;
REVOKE ALL ON FUNCTION public.update_school_details_before_step_up(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.update_school_details(
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_recent_admin_authentication() THEN
    RAISE EXCEPTION 'Recent administrator authentication required';
  END IF;
  RETURN public.update_school_details_before_step_up(
    target_school_id,
    requested_name,
    requested_short_name,
    requested_address,
    requested_city,
    requested_state,
    requested_zip,
    requested_website_url,
    requested_logo_url,
    requested_mascot,
    requested_primary_color,
    requested_secondary_color,
    requested_slug,
    requested_is_active,
    requested_is_public
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_school_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_school_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION public.has_recent_admin_authentication(INTEGER) IS
  'Returns true only when the signed access token records a recent password, OAuth, SSO, or MFA authentication method.';

COMMIT;
