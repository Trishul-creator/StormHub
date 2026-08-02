-- Support tickets are intentionally submitted to administrators and are not
-- the same as private roster, attendance, coursework, or attachment records.
-- Keep ticket access school-scoped in the UI and district-scoped for district
-- administrators, while allowing active platform administrators to read the
-- support inbox without first opening a private-data support session.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_school_feedback(target_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.can_review_school_feedback(target_school_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'super_admin'
        AND actor.account_status = 'active'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.can_read_school_feedback(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_school_feedback(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_read_school_feedback(UUID) IS
  'School/district admins read feedback in scope; active platform admins may read submitted support tickets without private-data support access.';
COMMENT ON POLICY "feedback_admin_read" ON public.feedback IS
  'Support tickets remain school-scoped in product navigation; active platform admins may read them without opening private student records.';

COMMIT;
