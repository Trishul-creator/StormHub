BEGIN;

ALTER TABLE public.club_announcements
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

ALTER TABLE public.club_assignments
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_club_announcements_scheduled_release
  ON public.club_announcements(scheduled_for)
  WHERE status = 'draft' AND scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_assignments_scheduled_release
  ON public.club_assignments(scheduled_for)
  WHERE status = 'draft' AND scheduled_for IS NOT NULL;

COMMENT ON COLUMN public.club_announcements.scheduled_for IS
  'When a draft announcement should be published by the scheduled-content worker.';

COMMENT ON COLUMN public.club_assignments.scheduled_for IS
  'When a draft assignment should be published by the scheduled-content worker.';

CREATE OR REPLACE FUNCTION public.enforce_club_publication_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
BEGIN
  IF NEW.school_id IS NOT DISTINCT FROM OLD.school_id
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.visibility IS NOT DISTINCT FROM OLD.visibility
    AND NEW.is_listed IS NOT DISTINCT FROM OLD.is_listed
    AND NEW.is_featured IS NOT DISTINCT FROM OLD.is_featured
  THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role, school_id
  INTO actor_role, actor_school_id
  FROM public.profiles
  WHERE id = auth.uid() AND account_status = 'active';

  IF actor_role = 'super_admin' THEN
    RETURN NEW;
  END IF;
  IF actor_role = 'admin'
    AND actor_school_id = OLD.school_id
    AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only a school administrator can change club publication or featured status';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS clubs_enforce_publication_permissions ON public.clubs;
CREATE TRIGGER clubs_enforce_publication_permissions
  BEFORE UPDATE OF school_id, status, visibility, is_listed, is_featured ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_publication_permissions();

COMMIT;
