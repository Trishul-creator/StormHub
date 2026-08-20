-- Allow a school to require adult review for student-authored club content.
-- Existing schools retain the current behavior unless they explicitly opt in.

BEGIN;

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS student_content_requires_staff_approval BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.club_requires_staff_content_approval(club_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(settings.student_content_requires_staff_approval, FALSE)
  FROM public.clubs club
  LEFT JOIN public.school_settings settings ON settings.school_id = club.school_id
  WHERE club.id = club_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.club_requires_staff_content_approval(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_requires_staff_content_approval(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_content_approval()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  content_club_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';

  content_club_id := NEW.club_id;
  IF actor_role IN ('admin', 'super_admin') THEN RETURN NEW; END IF;
  IF content_club_id IS NOT NULL AND public.is_club_advisor(content_club_id) THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME IN ('club_announcements', 'club_resources')
    AND content_club_id IS NOT NULL
    AND public.is_club_president(content_club_id)
    AND NOT public.club_requires_staff_content_approval(content_club_id)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'This content requires approval from an authorized club Advisor or administrator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON COLUMN public.school_settings.student_content_requires_staff_approval IS
  'When true, student-authored announcements and resources stay private until an Advisor or school administrator approves them.';

COMMIT;
