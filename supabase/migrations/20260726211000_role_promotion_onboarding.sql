-- Give promoted users a fresh role-specific onboarding checklist.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reset_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.mark_profile_role_promotion()
RETURNS TRIGGER AS $$
DECLARE
  old_rank INT;
  new_rank INT;
BEGIN
  old_rank := CASE OLD.role
    WHEN 'student' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'super_admin' THEN 4
    ELSE 0
  END;
  new_rank := CASE NEW.role
    WHEN 'student' THEN 1
    WHEN 'teacher' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'super_admin' THEN 4
    ELSE 0
  END;
  IF NEW.role IS DISTINCT FROM OLD.role AND new_rank > old_rank THEN
    NEW.onboarding_reset_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS profiles_role_promotion_onboarding ON public.profiles;
CREATE TRIGGER profiles_role_promotion_onboarding
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mark_profile_role_promotion();

CREATE OR REPLACE FUNCTION public.mark_club_role_promotion()
RETURNS TRIGGER AS $$
DECLARE
  old_rank INT := 0;
  new_rank INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_rank := CASE OLD.role
      WHEN 'member' THEN 1
      WHEN 'officer' THEN 2
      WHEN 'president' THEN 3
      WHEN 'sponsor' THEN 4
      ELSE 0
    END;
  END IF;
  new_rank := CASE NEW.role
    WHEN 'member' THEN 1
    WHEN 'officer' THEN 2
    WHEN 'president' THEN 3
    WHEN 'sponsor' THEN 4
    ELSE 0
  END;

  IF NEW.status = 'active'
    AND NEW.role IN ('officer', 'president', 'sponsor')
    AND new_rank > old_rank
  THEN
    UPDATE public.profiles
    SET onboarding_reset_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS club_role_promotion_onboarding ON public.club_memberships;
CREATE TRIGGER club_role_promotion_onboarding
  AFTER INSERT OR UPDATE OF role, status ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.mark_club_role_promotion();

COMMENT ON COLUMN public.profiles.onboarding_reset_at IS
  'Set when an account or club-role promotion should start a fresh role checklist.';
