-- Make school signup codes optional per school, allow teachers to submit
-- school-wide opportunities for review, and track club suggestions from every
-- school role through the school-administrator approval workflow.

BEGIN;

ALTER TABLE public.school_signup_access
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.school_signup_access.is_enabled IS
  'When false, new accounts may join this school without an access code. Email-domain and account-verification protections still apply.';

CREATE OR REPLACE FUNCTION public.verify_school_signup_code(
  target_school_id UUID,
  candidate_code TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_signup_access access
    WHERE access.school_id = target_school_id
      AND (
        access.is_enabled = FALSE
        OR access.access_code = upper(trim(COALESCE(candidate_code, '')))
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.verify_school_signup_code(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_school_signup_code(UUID, TEXT)
  TO service_role;

-- The signup directory exposes only whether a code is required, never the
-- private code itself. This lets both password and Google signup forms adapt
-- without weakening the server-side verification above.
DROP FUNCTION IF EXISTS public.list_signup_schools(INTEGER, INTEGER, TEXT);
CREATE FUNCTION public.list_signup_schools(
  page_offset INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 100,
  search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_name TEXT,
  slug TEXT,
  logo_url TEXT,
  mascot TEXT,
  requires_access_code BOOLEAN
) AS $$
  SELECT
    school.id,
    school.name,
    school.short_name,
    school.slug,
    school.logo_url,
    school.mascot,
    COALESCE(access.is_enabled, TRUE) AS requires_access_code
  FROM public.schools school
  LEFT JOIN public.school_signup_access access ON access.school_id = school.id
  WHERE school.is_active = TRUE
    AND school.is_public = TRUE
    AND (
      NULLIF(BTRIM(COALESCE(search_text, '')), '') IS NULL
      OR LOWER(CONCAT_WS(' ', school.name, school.short_name, school.slug))
        LIKE '%' || LOWER(BTRIM(search_text)) || '%'
    )
  ORDER BY school.name, school.id
  LIMIT LEAST(GREATEST(COALESCE(page_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(page_offset, 0), 0);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.list_signup_schools(INTEGER, INTEGER, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signup_schools(INTEGER, INTEGER, TEXT)
  TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.club_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  suggested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('starter', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_suggestions_one_pending_per_user_club
  ON public.club_suggestions(suggested_by, club_id)
  WHERE status = 'pending' AND suggested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_suggestions_school_status_created
  ON public.club_suggestions(school_id, status, created_at DESC);

ALTER TABLE public.club_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_suggestions FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.club_suggestions TO authenticated;
GRANT ALL ON TABLE public.club_suggestions TO service_role;

DROP POLICY IF EXISTS "club_suggestions_read" ON public.club_suggestions;
CREATE POLICY "club_suggestions_read" ON public.club_suggestions
  FOR SELECT TO authenticated
  USING (suggested_by = auth.uid() OR public.can_admin_school(school_id));

DROP POLICY IF EXISTS "club_suggestions_insert_own" ON public.club_suggestions;
CREATE POLICY "club_suggestions_insert_own" ON public.club_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    suggested_by = auth.uid()
    AND school_id = public.current_user_school_id()
    AND EXISTS (
      SELECT 1
      FROM public.clubs club
      WHERE club.id = club_suggestions.club_id
        AND club.school_id = club_suggestions.school_id
        AND club.status = 'draft'
        AND club.is_active = FALSE
        AND club.is_listed = FALSE
    )
  );

DROP POLICY IF EXISTS "club_suggestions_admin_update" ON public.club_suggestions;
CREATE POLICY "club_suggestions_admin_update" ON public.club_suggestions
  FOR UPDATE TO authenticated
  USING (public.can_admin_school(school_id))
  WITH CHECK (public.can_admin_school(school_id));

-- Teachers can add opportunities only as pending items for their own school.
-- School and district administrators retain the existing publishing policy.
DROP POLICY IF EXISTS "opportunities_teacher_insert" ON public.opportunities;
CREATE POLICY "opportunities_teacher_insert" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'teacher'
    AND author_id = auth.uid()
    AND school_id = public.current_user_school_id()
    AND club_id IS NULL
    AND status = 'pending'
    AND visibility = 'public'
  );

DROP POLICY IF EXISTS "opportunities_author_read" ON public.opportunities;
CREATE POLICY "opportunities_author_read" ON public.opportunities
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() AND school_id = public.current_user_school_id());

COMMENT ON TABLE public.club_suggestions IS
  'Auditable school-scoped requests to activate a prepared or custom draft club. School administrators complete publication review.';

COMMIT;
