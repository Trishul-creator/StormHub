BEGIN;

CREATE INDEX IF NOT EXISTS idx_profiles_school_created
  ON public.profiles(school_id, created_at);
CREATE INDEX IF NOT EXISTS idx_club_memberships_joined
  ON public.club_memberships(joined_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_school_created
  ON public.analytics_events(school_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_updated
  ON public.club_assignment_submissions(updated_at);

CREATE OR REPLACE FUNCTION public.get_admin_statistics(
  requested_school_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_role TEXT;
  actor_school_id UUID;
  actor_status TEXT;
  effective_school_id UUID;
  result JSONB;
BEGIN
  SELECT role, school_id, account_status
  INTO actor_role, actor_school_id, actor_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_status IS DISTINCT FROM 'active'
    OR actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF actor_role = 'admin' THEN
    IF actor_school_id IS NULL THEN
      RAISE EXCEPTION 'School administrator account is not assigned to a school';
    END IF;
    IF requested_school_id IS NOT NULL
      AND requested_school_id IS DISTINCT FROM actor_school_id THEN
      RAISE EXCEPTION 'School administrators can only view statistics for their own school';
    END IF;
    effective_school_id := actor_school_id;
  ELSE
    effective_school_id := requested_school_id;
  END IF;

  IF effective_school_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.schools WHERE id = effective_school_id
    ) THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  WITH
  scoped_people AS (
    SELECT p.id, p.role, p.account_status, p.created_at
    FROM public.profiles p
    WHERE effective_school_id IS NULL OR p.school_id = effective_school_id
  ),
  scoped_clubs AS (
    SELECT c.id, c.name, c.slug, c.status, c.is_active, c.updated_at
    FROM public.clubs c
    WHERE effective_school_id IS NULL OR c.school_id = effective_school_id
  ),
  scoped_memberships AS (
    SELECT m.club_id, m.user_id, m.role, m.status, m.joined_at
    FROM public.club_memberships m
    JOIN scoped_clubs c ON c.id = m.club_id
    JOIN scoped_people p ON p.id = m.user_id
  ),
  scoped_events AS (
    SELECT e.id, e.club_id, e.status, e.starts_at, e.created_at
    FROM public.events e
    WHERE effective_school_id IS NULL OR e.school_id = effective_school_id
  ),
  scoped_analytics AS (
    SELECT a.user_id, a.entity_type, a.entity_id, a.created_at
    FROM public.analytics_events a
    WHERE effective_school_id IS NULL OR a.school_id = effective_school_id
  ),
  engaged_user_ids AS (
    SELECT a.user_id
    FROM scoped_analytics a
    WHERE a.user_id IS NOT NULL
      AND a.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT m.user_id
    FROM scoped_memberships m
    WHERE m.joined_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT r.user_id
    FROM public.event_rsvps r
    JOIN scoped_people p ON p.id = r.user_id
    WHERE r.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT b.user_id
    FROM public.bookmarks b
    JOIN scoped_people p ON p.id = b.user_id
    WHERE b.created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT s.student_id
    FROM public.club_assignment_submissions s
    JOIN scoped_people p ON p.id = s.student_id
    WHERE COALESCE(s.submitted_at, s.updated_at, s.created_at) >= NOW() - INTERVAL '30 days'
  ),
  role_rows AS (
    SELECT role, COUNT(*) AS count
    FROM scoped_people
    GROUP BY role
  ),
  club_statuses(status, sort_order) AS (
    VALUES
      ('active'::TEXT, 1),
      ('interest_open'::TEXT, 2),
      ('draft'::TEXT, 3),
      ('paused'::TEXT, 4),
      ('archived'::TEXT, 5)
  ),
  club_status_rows AS (
    SELECT s.status, s.sort_order, COUNT(c.id) AS count
    FROM club_statuses s
    LEFT JOIN scoped_clubs c ON c.status = s.status
    GROUP BY s.status, s.sort_order
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - INTERVAL '5 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS month_start
  ),
  monthly_rows AS (
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month,
      (
        SELECT COUNT(*)
        FROM scoped_people p
        WHERE p.created_at >= m.month_start
          AND p.created_at < m.month_start + INTERVAL '1 month'
      ) AS new_people,
      (
        SELECT COUNT(*)
        FROM scoped_memberships cm
        WHERE cm.joined_at >= m.month_start
          AND cm.joined_at < m.month_start + INTERVAL '1 month'
          AND cm.status = 'active'
          AND cm.role <> 'sponsor'
      ) AS new_memberships,
      (
        SELECT COUNT(*)
        FROM scoped_analytics a
        WHERE a.created_at >= m.month_start
          AND a.created_at < m.month_start + INTERVAL '1 month'
      ) AS engagement_events
    FROM months m
  ),
  top_club_rows AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.status,
      (
        SELECT COUNT(*)
        FROM scoped_memberships m
        WHERE m.club_id = c.id
          AND m.status = 'active'
          AND m.role <> 'sponsor'
      ) AS members,
      (
        SELECT COUNT(*)
        FROM scoped_events e
        WHERE e.club_id = c.id
          AND e.status = 'approved'
          AND e.starts_at >= NOW() - INTERVAL '30 days'
      ) AS recent_events,
      (
        SELECT COUNT(*)
        FROM scoped_analytics a
        WHERE a.entity_type = 'club'
          AND a.entity_id = c.id
          AND a.created_at >= NOW() - INTERVAL '30 days'
      ) AS recent_activity
    FROM scoped_clubs c
    WHERE c.status IN ('active', 'interest_open')
      AND c.is_active IS DISTINCT FROM FALSE
  ),
  ranked_clubs AS (
    SELECT
      t.*,
      (t.members + (t.recent_events * 3) + t.recent_activity) AS score
    FROM top_club_rows t
    ORDER BY score DESC, members DESC, name
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'scopeSchoolId', effective_school_id,
    'totalPeople', (SELECT COUNT(*) FROM scoped_people),
    'activePeople', (
      SELECT COUNT(*) FROM scoped_people WHERE account_status = 'active'
    ),
    'engagedPeople30d', (
      SELECT COUNT(DISTINCT e.user_id)
      FROM engaged_user_ids e
      JOIN scoped_people p ON p.id = e.user_id
      WHERE p.account_status = 'active'
    ),
    'newPeople30d', (
      SELECT COUNT(*)
      FROM scoped_people
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'totalClubs', (SELECT COUNT(*) FROM scoped_clubs),
    'activeClubs', (
      SELECT COUNT(*)
      FROM scoped_clubs
      WHERE status = 'active' AND is_active IS DISTINCT FROM FALSE
    ),
    'activeMemberships', (
      SELECT COUNT(*)
      FROM scoped_memberships
      WHERE status = 'active' AND role <> 'sponsor'
    ),
    'upcomingEvents', (
      SELECT COUNT(*)
      FROM scoped_events
      WHERE status = 'approved' AND starts_at >= NOW()
    ),
    'engagementEvents30d', (
      SELECT COUNT(*)
      FROM scoped_analytics
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'roleDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('role', role, 'count', count)
        ORDER BY count DESC, role
      )
      FROM role_rows
    ), '[]'::JSONB),
    'clubStatusDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('status', status, 'count', count)
        ORDER BY sort_order
      )
      FROM club_status_rows
    ), '[]'::JSONB),
    'monthlyActivity', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'month', month,
          'newPeople', new_people,
          'newMemberships', new_memberships,
          'engagementEvents', engagement_events
        )
        ORDER BY month
      )
      FROM monthly_rows
    ), '[]'::JSONB),
    'topClubs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'slug', slug,
          'status', status,
          'members', members,
          'recentEvents', recent_events,
          'recentActivity', recent_activity,
          'score', score
        )
        ORDER BY score DESC, members DESC, name
      )
      FROM ranked_clubs
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_statistics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_statistics(UUID) TO authenticated;

COMMIT;
