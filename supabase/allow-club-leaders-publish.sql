-- StormHub patch: allow club officers and presidents to publish club content.
-- Run this in Supabase SQL Editor after the main fix-current-db.sql patch.
-- It keeps school-wide opportunities admin-only and still lets teachers/admins
-- archive/delete club content through the app.

CREATE OR REPLACE FUNCTION public.enforce_content_approval()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  content_club_id := NEW.club_id;

  IF actor_role IN ('admin', 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF content_club_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.club_memberships
    WHERE club_id = content_club_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND (
        (actor_role = 'teacher' AND role = 'sponsor')
        OR (actor_role = 'student' AND role IN ('officer', 'president'))
      )
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'This content requires a club leader, teacher sponsor, or administrator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
