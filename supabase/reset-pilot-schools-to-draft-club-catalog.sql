-- StormHub one-time reset: make pilot schools publicly blank and replace
-- existing club data with hidden draft catalogs.
--
-- Schools affected:
-- - elkhorn-south
-- - elkhorn-north
--
-- Run only if you intentionally want to remove current clubs, memberships,
-- club events, club opportunities, announcements, and resources for these
-- schools. This does NOT delete users, profiles, schools, or super_admins.

BEGIN;

CREATE OR REPLACE FUNCTION public.stormhub_reset_school_to_draft_catalog(
  target_school_slug TEXT
)
RETURNS VOID AS $$
DECLARE
  target_school_id UUID;
  slug_prefix TEXT;
BEGIN
  SELECT id INTO target_school_id
  FROM public.schools
  WHERE slug = target_school_slug
  LIMIT 1;

  IF target_school_id IS NULL THEN
    RAISE EXCEPTION 'School not found: %', target_school_slug;
  END IF;

  slug_prefix := target_school_slug || '-';

  DELETE FROM public.approval_requests
  WHERE school_id = target_school_id;

  DELETE FROM public.interest_forms
  WHERE school_id = target_school_id;

  DELETE FROM public.event_rsvps
  WHERE event_id IN (
    SELECT id FROM public.events WHERE school_id = target_school_id
  );

  DELETE FROM public.bookmarks
  WHERE club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id)
     OR event_id IN (SELECT id FROM public.events WHERE school_id = target_school_id)
     OR opportunity_id IN (SELECT id FROM public.opportunities WHERE school_id = target_school_id);

  DELETE FROM public.notifications
  WHERE school_id = target_school_id
     OR club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id)
     OR event_id IN (SELECT id FROM public.events WHERE school_id = target_school_id)
     OR opportunity_id IN (SELECT id FROM public.opportunities WHERE school_id = target_school_id);

  DELETE FROM public.club_announcements
  WHERE club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id);

  DELETE FROM public.club_resources
  WHERE club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id);

  DELETE FROM public.club_memberships
  WHERE club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id);

  UPDATE public.service_hours
  SET club_id = NULL,
      opportunity_id = NULL
  WHERE club_id IN (SELECT id FROM public.clubs WHERE school_id = target_school_id)
     OR opportunity_id IN (SELECT id FROM public.opportunities WHERE school_id = target_school_id);

  DELETE FROM public.opportunities
  WHERE school_id = target_school_id;

  DELETE FROM public.events
  WHERE school_id = target_school_id;

  UPDATE public.workshops
  SET club_id = NULL,
      status = 'archived'
  WHERE school_id = target_school_id;

  DELETE FROM public.clubs
  WHERE school_id = target_school_id;

  INSERT INTO public.clubs (
    school_id, name, slug, short_description, long_description, category, tags,
    sponsor_name, meeting_time, meeting_location, join_instructions,
    status, is_listed, is_featured, is_active, visibility
  ) VALUES
  (target_school_id, 'Art Club', slug_prefix || 'art-club',
    'A draft club for students interested in visual arts and creative projects.',
    'Use this draft if the school confirms an Art Club. Update sponsor, description, and join instructions before publishing.',
    'Arts', ARRAY['art','creative','visual arts'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Band', slug_prefix || 'band',
    'A draft club/activity page for band-related announcements and resources.',
    'Use this draft if band should be represented in StormHub. Update details before publishing.',
    'Music', ARRAY['music','band','performance'], NULL, NULL, NULL,
    'Details will be posted once the activity is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Choir', slug_prefix || 'choir',
    'A draft club/activity page for choir updates and resources.',
    'Use this draft if choir should be represented in StormHub. Update details before publishing.',
    'Music', ARRAY['music','choir','performance'], NULL, NULL, NULL,
    'Details will be posted once the activity is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Drama Club', slug_prefix || 'drama-club',
    'A draft club for theatre, acting, production, and stage crew opportunities.',
    'Confirm the sponsor and season details before publishing.',
    'Arts', ARRAY['theatre','drama','stage'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'DECA', slug_prefix || 'deca',
    'A draft club for business, marketing, leadership, and competition activities.',
    'Confirm the school chapter and sponsor before publishing.',
    'Business', ARRAY['business','marketing','leadership','competition'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'FBLA', slug_prefix || 'fbla',
    'A draft club for business leadership and career preparation.',
    'Confirm the school chapter and sponsor before publishing.',
    'Business', ARRAY['business','leadership','career'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'FCA', slug_prefix || 'fca',
    'A draft club for Fellowship of Christian Athletes if confirmed by the school.',
    'Confirm sponsor, description, and school approval before publishing.',
    'Faith/Community', ARRAY['community','leadership'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Math Club', slug_prefix || 'math-club',
    'A draft club for math enrichment, contests, and problem-solving.',
    'Update contest details, sponsor, and join instructions before publishing.',
    'STEM', ARRAY['math','competition','stem'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'National Honor Society', slug_prefix || 'national-honor-society',
    'A draft organization page for NHS announcements and resources.',
    'Confirm eligibility rules, sponsor, and member-only visibility before publishing.',
    'Leadership', ARRAY['honor society','leadership','service'], NULL, NULL, NULL,
    'Details will be posted once the organization is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Robotics Club', slug_prefix || 'robotics-club',
    'A draft club for robotics, engineering, and build team activities.',
    'Confirm sponsor, team structure, and join instructions before publishing.',
    'STEM', ARRAY['robotics','engineering','stem'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Science Bowl', slug_prefix || 'science-bowl',
    'A draft club for science competition practices and team updates.',
    'Confirm sponsor, practice details, and competition information before publishing.',
    'STEM', ARRAY['science','competition','stem'], NULL, NULL, NULL,
    'Details will be posted once the club is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted'),
  (target_school_id, 'Student Council', slug_prefix || 'student-council',
    'A draft page for student leadership, events, and school spirit initiatives.',
    'Confirm sponsor and leadership details before publishing.',
    'Leadership', ARRAY['leadership','student council','school spirit'], NULL, NULL, NULL,
    'Details will be posted once the organization is confirmed.', 'draft', FALSE, FALSE, TRUE, 'unlisted')
  ON CONFLICT (slug) DO UPDATE SET
    school_id = EXCLUDED.school_id,
    short_description = EXCLUDED.short_description,
    long_description = EXCLUDED.long_description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    sponsor_name = EXCLUDED.sponsor_name,
    meeting_time = EXCLUDED.meeting_time,
    meeting_location = EXCLUDED.meeting_location,
    join_instructions = EXCLUDED.join_instructions,
    status = 'draft',
    is_listed = FALSE,
    is_featured = FALSE,
    is_active = TRUE,
    visibility = 'unlisted',
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT public.stormhub_reset_school_to_draft_catalog('elkhorn-south');
SELECT public.stormhub_reset_school_to_draft_catalog('elkhorn-north');

DROP FUNCTION public.stormhub_reset_school_to_draft_catalog(TEXT);

COMMIT;
