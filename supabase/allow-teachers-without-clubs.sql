-- StormHub patch: allow teacher accounts with no club assignments.
-- Run this in Supabase SQL Editor after existing StormHub patches.
-- This keeps club sponsor assignment optional when creating or editing teachers.

CREATE OR REPLACE FUNCTION public.admin_set_user_role_and_clubs(
  target_user_id UUID,
  new_role TEXT,
  assigned_club_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS VOID AS $$
DECLARE
  actor_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

  IF actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF new_role NOT IN ('student', 'teacher', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF actor_role = 'admin' AND (
    target_role NOT IN ('student', 'teacher')
    OR new_role NOT IN ('student', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Only a super admin can modify admin-level accounts';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  UPDATE public.club_memberships
  SET role = 'member', status = 'left'
  WHERE user_id = target_user_id
    AND role = 'sponsor'
    AND (
      new_role <> 'teacher'
      OR COALESCE(array_length(assigned_club_ids, 1), 0) = 0
      OR NOT (club_id = ANY(assigned_club_ids))
    );

  IF new_role = 'teacher' THEN
    IF COALESCE(array_length(assigned_club_ids, 1), 0) > 0 THEN
      UPDATE public.club_memberships
      SET role = 'member', status = 'left'
      WHERE user_id = target_user_id
        AND NOT (club_id = ANY(assigned_club_ids));

      INSERT INTO public.club_memberships (club_id, user_id, status, role)
      SELECT club_id, target_user_id, 'active', 'sponsor'
      FROM unnest(assigned_club_ids) AS assigned(club_id)
      WHERE EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = assigned.club_id)
      ON CONFLICT (club_id, user_id)
      DO UPDATE SET status = 'active', role = 'sponsor';
    END IF;
  ELSIF new_role IN ('admin', 'super_admin') THEN
    UPDATE public.club_memberships
    SET status = 'left', role = 'member'
    WHERE user_id = target_user_id AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_and_clubs(UUID, TEXT, UUID[]) TO authenticated;
