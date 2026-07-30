-- Give school-scoped opportunity managers a distinct "closed" state.
-- Closed listings retain participation history and may be reopened, while
-- archived listings remain available only in the administrative inventory.

BEGIN;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'closed', 'archived'));

CREATE INDEX IF NOT EXISTS idx_opportunities_school_status_created
  ON public.opportunities(school_id, status, created_at DESC);

DROP TRIGGER IF EXISTS opportunities_audit_delete ON public.opportunities;
DROP TRIGGER IF EXISTS opportunities_audit_change ON public.opportunities;
CREATE TRIGGER opportunities_audit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

DROP POLICY IF EXISTS "opportunity_signups_insert_own" ON public.opportunity_signups;
CREATE POLICY "opportunity_signups_insert_own" ON public.opportunity_signups
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      JOIN public.profiles profile ON profile.id = auth.uid()
      WHERE opportunity.id = opportunity_signups.opportunity_id
        AND opportunity.school_id = profile.school_id
        AND opportunity.status = 'approved'
        AND opportunity.visibility = 'public'
        AND (opportunity.deadline IS NULL OR opportunity.deadline > NOW())
        AND profile.account_status = 'active'
    )
  );

DROP POLICY IF EXISTS "opportunity_signups_update_own" ON public.opportunity_signups;
CREATE POLICY "opportunity_signups_update_own" ON public.opportunity_signups
  FOR UPDATE USING (user_id = auth.uid() AND public.get_user_role() = 'student')
  WITH CHECK (
    user_id = auth.uid()
    AND public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      JOIN public.profiles profile ON profile.id = auth.uid()
      WHERE opportunity.id = opportunity_signups.opportunity_id
        AND opportunity.school_id = profile.school_id
        AND opportunity.status = 'approved'
        AND opportunity.visibility = 'public'
        AND (opportunity.deadline IS NULL OR opportunity.deadline > NOW())
        AND profile.account_status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION public.delete_unused_opportunity(
  target_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.opportunities%ROWTYPE;
BEGIN
  SELECT *
  INTO target
  FROM public.opportunities
  WHERE id = target_opportunity_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.can_admin_school(target.school_id) THEN
    RAISE EXCEPTION 'Opportunity not found in your authorized school';
  END IF;
  IF target.status NOT IN ('draft', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'Published opportunities must be archived';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.opportunity_signups WHERE opportunity_id = target.id
    UNION ALL
    SELECT 1 FROM public.bookmarks WHERE opportunity_id = target.id
    UNION ALL
    SELECT 1 FROM public.service_hours WHERE opportunity_id = target.id
    UNION ALL
    SELECT 1 FROM public.interest_forms WHERE opportunity_id = target.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Opportunity has student activity and must be archived';
  END IF;

  DELETE FROM public.approval_requests
  WHERE content_type = 'opportunity'
    AND content_id = target.id;
  DELETE FROM public.opportunities
  WHERE id = target.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_unused_opportunity(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_unused_opportunity(UUID) TO authenticated;

COMMENT ON COLUMN public.opportunities.status IS
  'draft/pending/rejected are unpublished workflow states; approved is student-visible; closed retains history and can be reopened; archived is retained administrative history.';

COMMIT;
