-- Track opportunity participation separately from saved/bookmarked items.
-- Students can register only for visible opportunities in their own school.

CREATE TABLE IF NOT EXISTS public.opportunity_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_signups_user
  ON public.opportunity_signups(user_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunity_signups_opportunity
  ON public.opportunity_signups(opportunity_id, status);

ALTER TABLE public.opportunity_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunity_signups_read" ON public.opportunity_signups;
CREATE POLICY "opportunity_signups_read" ON public.opportunity_signups
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE opportunity.id = opportunity_signups.opportunity_id
        AND public.can_admin_school(opportunity.school_id)
    )
  );

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
        AND profile.account_status = 'active'
    )
  );

DROP POLICY IF EXISTS "opportunity_signups_delete_own" ON public.opportunity_signups;
CREATE POLICY "opportunity_signups_delete_own" ON public.opportunity_signups
  FOR DELETE USING (user_id = auth.uid() AND public.get_user_role() = 'student');

REVOKE ALL ON TABLE public.opportunity_signups FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opportunity_signups TO authenticated;

COMMENT ON TABLE public.opportunity_signups IS
  'In-app student opportunity registrations and RSVPs; intentionally separate from bookmarks.';
