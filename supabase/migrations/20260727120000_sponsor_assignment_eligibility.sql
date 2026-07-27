-- Limit teacher sponsorships to live clubs in the teacher's own school.
-- Empty club lists remain valid so teacher accounts can exist before a club is published.

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
  IF new_role = 'teacher' AND EXISTS (
    SELECT 1
    FROM unnest(normalized_club_ids) AS assigned(club_id)
    LEFT JOIN public.clubs c ON c.id = assigned.club_id
    WHERE c.id IS NULL
      OR c.school_id IS DISTINCT FROM target.school_id
      OR (actor.role = 'admin' AND c.school_id IS DISTINCT FROM actor.school_id)
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
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;
