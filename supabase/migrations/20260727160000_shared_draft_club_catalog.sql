-- Give every school a broad, private draft-club catalog that administrators can
-- customize and publish. This migration is additive: it never changes or
-- replaces an existing club with the same name.

CREATE OR REPLACE FUNCTION public.seed_default_club_catalog(target_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clubs (
    school_id,
    name,
    slug,
    short_description,
    long_description,
    category,
    tags,
    join_instructions,
    status,
    is_listed,
    is_featured,
    is_active,
    visibility
  )
  SELECT
    school.id,
    template.name,
    school.slug || '-' || template.slug,
    template.short_description,
    'This is a prepared StormHub template. Confirm the club name, sponsor, description, meeting details, and joining process before publishing it.',
    template.category,
    template.tags,
    'Update these instructions before publishing.',
    'draft',
    FALSE,
    FALSE,
    FALSE,
    'unlisted'
  FROM public.schools AS school
  CROSS JOIN (
    VALUES
      ('academic-decathlon', 'Academic Decathlon', 'Academic competition spanning science, literature, economics, mathematics, art, and more.', 'Competition', ARRAY['academics','competition','team']),
      ('quiz-bowl', 'Quiz Bowl', 'Fast-paced academic trivia practices and competitions.', 'Competition', ARRAY['academics','trivia','competition']),
      ('debate', 'Debate Club', 'Build argumentation, research, public speaking, and competitive debate skills.', 'Competition', ARRAY['debate','public speaking','research']),
      ('speech', 'Speech Club', 'Practice public speaking, interpretation, and competitive speech events.', 'Competition', ARRAY['speech','public speaking','competition']),
      ('mock-trial', 'Mock Trial', 'Prepare and present simulated court cases as attorneys and witnesses.', 'Competition', ARRAY['law','courtroom','competition']),
      ('model-un', 'Model United Nations', 'Explore international issues through diplomacy, research, and conference simulations.', 'Leadership', ARRAY['international','diplomacy','leadership']),
      ('chess-club', 'Chess Club', 'Play, learn, and compete in chess at all skill levels.', 'Competition', ARRAY['chess','strategy','competition']),
      ('science-olympiad', 'Science Olympiad', 'Prepare for team-based science and engineering events.', 'STEM', ARRAY['science','engineering','competition']),
      ('science-bowl', 'Science Bowl', 'Practice fast-paced science and mathematics questions for competition.', 'STEM', ARRAY['science','math','competition']),
      ('math-club', 'Math Club', 'Explore problem solving, enrichment topics, and mathematics competitions.', 'STEM', ARRAY['math','problem solving','competition']),
      ('robotics-club', 'Robotics Club', 'Design, build, program, and test robots as a team.', 'STEM', ARRAY['robotics','engineering','programming']),
      ('coding-club', 'Coding Club', 'Learn programming and collaborate on software projects and competitions.', 'STEM', ARRAY['coding','computer science','technology']),
      ('engineering-club', 'Engineering Club', 'Tackle hands-on design challenges across engineering disciplines.', 'STEM', ARRAY['engineering','design','building']),
      ('environmental-club', 'Environmental Club', 'Lead sustainability, conservation, and environmental education projects.', 'Service', ARRAY['environment','sustainability','service']),
      ('astronomy-club', 'Astronomy Club', 'Explore space science through observation, discussion, and projects.', 'STEM', ARRAY['astronomy','space','science']),
      ('esports-club', 'Esports Club', 'Organize team-based competitive gaming, practices, and events.', 'Competition', ARRAY['esports','gaming','team']),
      ('art-club', 'Art Club', 'Create and share visual art through student-led projects and workshops.', 'Arts', ARRAY['art','creative','visual arts']),
      ('photography-club', 'Photography Club', 'Learn photography, editing, storytelling, and exhibition skills.', 'Arts', ARRAY['photography','media','creative']),
      ('drama-club', 'Drama Club', 'Participate in acting, directing, technical theatre, and productions.', 'Arts', ARRAY['drama','theatre','stage']),
      ('improv-club', 'Improv Club', 'Build confidence, creativity, and teamwork through improvisational theatre.', 'Arts', ARRAY['improv','theatre','performance']),
      ('film-club', 'Film Club', 'Watch, discuss, write, shoot, and edit student films.', 'Arts', ARRAY['film','video','media']),
      ('creative-writing-club', 'Creative Writing Club', 'Write and workshop fiction, poetry, scripts, and creative nonfiction.', 'Arts', ARRAY['writing','poetry','creative']),
      ('journalism', 'Journalism / Newspaper', 'Report school stories and produce student news across print and digital media.', 'Arts', ARRAY['journalism','newspaper','media']),
      ('yearbook', 'Yearbook', 'Document the school year through writing, photography, and design.', 'Arts', ARRAY['yearbook','photography','design']),
      ('literary-magazine', 'Literary Magazine', 'Publish student writing, artwork, photography, and design.', 'Arts', ARRAY['literature','writing','publishing']),
      ('band', 'Band', 'Share concert, marching, rehearsal, performance, and resource updates.', 'Music', ARRAY['band','music','performance']),
      ('jazz-band', 'Jazz Band', 'Rehearse and perform jazz repertoire and improvisation.', 'Music', ARRAY['jazz','band','music']),
      ('orchestra', 'Orchestra', 'Share orchestra rehearsals, performances, and student resources.', 'Music', ARRAY['orchestra','strings','music']),
      ('choir', 'Choir', 'Share vocal ensemble rehearsals, concerts, and resources.', 'Music', ARRAY['choir','vocal','music']),
      ('show-choir', 'Show Choir', 'Combine vocal music, choreography, and ensemble performance.', 'Music', ARRAY['choir','dance','performance']),
      ('color-guard', 'Color Guard / Winter Guard', 'Combine dance, equipment work, and ensemble performance.', 'Music', ARRAY['color guard','dance','performance']),
      ('dance-team', 'Dance Team', 'Prepare for performances, competitions, and school events.', 'Arts', ARRAY['dance','performance','team']),
      ('student-council', 'Student Council', 'Represent students and coordinate school leadership, events, and service.', 'Leadership', ARRAY['student government','leadership','school spirit']),
      ('national-honor-society', 'National Honor Society', 'Coordinate scholarship, leadership, character, and service activities.', 'Leadership', ARRAY['honor society','leadership','service']),
      ('key-club', 'Key Club', 'Serve the school and community through student-led volunteer projects.', 'Service', ARRAY['service','volunteering','leadership']),
      ('deca', 'DECA', 'Develop business, marketing, finance, hospitality, and leadership skills.', 'Leadership', ARRAY['business','marketing','competition']),
      ('fbla', 'FBLA', 'Explore business careers through leadership, projects, and competitions.', 'Leadership', ARRAY['business','career','competition']),
      ('fccla', 'FCCLA', 'Build leadership through family, career, and community-focused projects.', 'Leadership', ARRAY['career','community','leadership']),
      ('hosa', 'HOSA – Future Health Professionals', 'Explore health careers through service, learning, and competition.', 'Leadership', ARRAY['health','career','competition']),
      ('skillsusa', 'SkillsUSA', 'Develop technical, skilled-trade, workplace, and leadership abilities.', 'Leadership', ARRAY['career','technical','leadership']),
      ('future-educators', 'Future Educators', 'Explore education careers through service, observation, and professional learning.', 'Leadership', ARRAY['education','career','service']),
      ('ambassador-club', 'Student Ambassadors', 'Welcome new students and represent the school at events.', 'Leadership', ARRAY['ambassadors','welcome','leadership']),
      ('peer-mentors', 'Peer Mentors', 'Support younger and new students through mentoring and school connection.', 'Service', ARRAY['mentoring','support','service']),
      ('interact-club', 'Interact Club', 'Organize local and international service projects with student leadership.', 'Service', ARRAY['service','community','leadership']),
      ('red-cross-club', 'Red Cross Club', 'Support preparedness, blood drives, and humanitarian service projects.', 'Service', ARRAY['service','health','preparedness']),
      ('mental-health-awareness', 'Mental Health Awareness Club', 'Promote well-being, connection, and responsible mental health awareness.', 'Service', ARRAY['wellness','awareness','support']),
      ('best-buddies', 'Best Buddies / Unified Club', 'Build inclusive friendships, activities, and school community.', 'Service', ARRAY['inclusion','friendship','service']),
      ('sadd', 'SADD', 'Promote safe and healthy decisions through peer education and activities.', 'Service', ARRAY['safety','wellness','service']),
      ('spanish-club', 'Spanish Club', 'Explore Spanish language and cultures through activities and events.', 'Language/Culture', ARRAY['spanish','language','culture']),
      ('french-club', 'French Club', 'Explore French language and Francophone cultures through activities and events.', 'Language/Culture', ARRAY['french','language','culture']),
      ('german-club', 'German Club', 'Explore German language and cultures through activities and events.', 'Language/Culture', ARRAY['german','language','culture']),
      ('japanese-club', 'Japanese Club', 'Explore Japanese language and culture through activities and events.', 'Language/Culture', ARRAY['japanese','language','culture']),
      ('international-club', 'International Club', 'Celebrate global cultures and connect students across backgrounds.', 'Language/Culture', ARRAY['international','culture','community']),
      ('cultural-awareness-club', 'Cultural Awareness Club', 'Share traditions, histories, and student-led cultural learning.', 'Language/Culture', ARRAY['culture','awareness','community']),
      ('world-language-club', 'World Language Club', 'Explore languages and cultures represented in the school community.', 'Language/Culture', ARRAY['language','culture','international']),
      ('book-club', 'Book Club', 'Choose, read, and discuss books across genres and perspectives.', 'Arts', ARRAY['books','reading','discussion']),
      ('board-game-club', 'Board Game Club', 'Play modern and classic tabletop games in a welcoming community.', 'Recreation', ARRAY['board games','strategy','social']),
      ('tabletop-roleplaying-club', 'Tabletop Roleplaying Club', 'Tell collaborative stories through tabletop roleplaying games.', 'Recreation', ARRAY['tabletop','roleplaying','games']),
      ('outdoor-club', 'Outdoor Club', 'Plan outdoor recreation, conservation, and nature activities.', 'Recreation', ARRAY['outdoors','nature','recreation']),
      ('gardening-club', 'Gardening Club', 'Grow plants and support school garden and sustainability projects.', 'Service', ARRAY['gardening','sustainability','service']),
      ('culinary-club', 'Culinary Club', 'Practice cooking, baking, food safety, and culinary creativity.', 'Recreation', ARRAY['cooking','baking','culinary']),
      ('fashion-club', 'Fashion Club', 'Explore fashion design, construction, styling, and sustainable clothing.', 'Arts', ARRAY['fashion','design','creative']),
      ('intramurals', 'Intramurals', 'Organize inclusive recreational sports and friendly competitions.', 'Recreation', ARRAY['sports','recreation','wellness']),
      ('pep-club', 'Pep Club', 'Build school spirit and support student activities and teams.', 'Leadership', ARRAY['school spirit','community','leadership'])
  ) AS template(slug, name, short_description, category, tags)
  WHERE school.id = target_school_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.clubs AS existing
      WHERE existing.school_id = school.id
        AND LOWER(BTRIM(existing.name)) = LOWER(BTRIM(template.name))
    )
  ON CONFLICT (slug) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_default_club_catalog(UUID) IS
  'Adds missing private draft club templates to a school without changing existing clubs.';

CREATE OR REPLACE FUNCTION public.seed_default_club_catalog_for_new_school()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_club_catalog(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_seed_default_club_catalog ON public.schools;
CREATE TRIGGER schools_seed_default_club_catalog
  AFTER INSERT ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_club_catalog_for_new_school();

DO $$
DECLARE
  school_record RECORD;
BEGIN
  FOR school_record IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_default_club_catalog(school_record.id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_club_catalog(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_club_catalog_for_new_school() FROM PUBLIC, anon, authenticated;
