-- Complete the audited, read-only platform support path. The application
-- records every private support view through this RPC, but the original
-- privacy migration only created the session and evidence tables.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_platform_support_access(
  target_school_id UUID,
  requested_action TEXT,
  requested_resource_type TEXT,
  requested_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  active_session_id UUID;
  actor_id UUID := auth.uid();
  normalized_action TEXT := lower(trim(COALESCE(requested_action, '')));
  normalized_resource_type TEXT := trim(COALESCE(requested_resource_type, ''));
BEGIN
  IF actor_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF normalized_action NOT IN ('view', 'download') THEN
    RAISE EXCEPTION 'Unsupported platform support access action';
  END IF;
  IF char_length(normalized_resource_type) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Platform support resource type is required';
  END IF;

  SELECT support_session.id
  INTO active_session_id
  FROM public.platform_support_sessions support_session
  JOIN public.profiles actor
    ON actor.id = support_session.actor_user_id
  WHERE support_session.actor_user_id = actor_id
    AND support_session.school_id = target_school_id
    AND support_session.ended_at IS NULL
    AND support_session.expires_at > NOW()
    AND actor.role = 'super_admin'
    AND actor.account_status = 'active'
  ORDER BY support_session.expires_at DESC
  LIMIT 1;

  IF active_session_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.platform_support_access_log (
    session_id,
    actor_user_id,
    school_id,
    action,
    resource_type,
    resource_id
  ) VALUES (
    active_session_id,
    actor_id,
    target_school_id,
    normalized_action,
    normalized_resource_type,
    requested_resource_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_platform_support_access(
  UUID,
  TEXT,
  TEXT,
  UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_platform_support_access(
  UUID,
  TEXT,
  TEXT,
  UUID
) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_platform_support_access(
  UUID,
  TEXT,
  TEXT,
  UUID
) IS
  'Records a read-only platform support access event only while the actor has an active support session for the exact school.';

COMMIT;
