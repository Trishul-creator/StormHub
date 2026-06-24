-- StormHub Seed Data for Elkhorn South High School
-- Run after schema.sql

-- School
INSERT INTO schools (id, name, slug, city, state, mascot, website_url)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Elkhorn South High School',
  'elkhorn-south',
  'Omaha',
  'Nebraska',
  'Storm',
  'https://www.elkhornsouth.org'
) ON CONFLICT (slug) DO NOTHING;

-- Featured Clubs
INSERT INTO clubs (id, school_id, name, slug, short_description, long_description, category, tags, meeting_time, meeting_location, join_instructions, is_featured, is_active, visibility) VALUES
('c0000001-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Science Bowl', 'science-bowl',
 'Competitive buzzer-based science and math team preparing for regional and national-level competitions.',
 'Science Bowl is for students who enjoy fast-paced science and math questions. Members practice topics such as biology, chemistry, physics, earth science, astronomy, energy, and math. The club includes weekly practice, subject study groups, mock rounds, and tournament preparation.',
 'Science', ARRAY['science', 'competition', 'buzzer', 'physics', 'chemistry', 'biology', 'earth science', 'astronomy', 'math'],
 'TBD', 'TBD', 'Join the club to receive practice schedules, subject resources, tryout information, and tournament updates.', true, true, 'public'),

('c0000001-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Math Club', 'math-club',
 'A community for students interested in contest math, problem solving, AMC/AIME preparation, and math enrichment.',
 'Math Club helps students explore mathematical problem solving beyond the classroom. Members can prepare for contests such as AMC, work on challenging problems, run student-led lessons, and form study groups for algebra, geometry, combinatorics, number theory, and probability.',
 'Math', ARRAY['AMC', 'AIME', 'contests', 'problem solving', 'olympiad', 'math team'],
 'TBD', 'TBD', 'Join for announcements about practices, competitions, problem sets, and student-led workshops.', true, true, 'public'),

('c0000001-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Robotics Club', 'robotics-club',
 'Hands-on robotics team focused on designing, building, programming, and competing with robots.',
 'Robotics Club gives students experience with engineering design, coding, mechanical systems, CAD, strategy, teamwork, and competition. Members work on robot design, programming, build sessions, driver practice, and tournament preparation.',
 'Engineering', ARRAY['robotics', 'VEX', 'programming', 'engineering', 'CAD', 'controls', 'design', 'build'],
 'TBD', 'TBD', 'Join to receive build session schedules, competition details, team updates, and resource links.', true, true, 'public')
ON CONFLICT (slug) DO NOTHING;

-- Summer launch visibility: only the three ready clubs are public/listed.
UPDATE clubs
SET status = 'interest_open', is_listed = TRUE, is_featured = TRUE, is_active = TRUE, visibility = 'public'
WHERE slug IN ('science-bowl', 'math-club', 'robotics-club');

UPDATE clubs
SET status = 'draft', is_listed = FALSE, is_featured = FALSE
WHERE slug NOT IN ('science-bowl', 'math-club', 'robotics-club');

-- Additional Clubs
INSERT INTO clubs (school_id, name, slug, short_description, category, tags, meeting_time, meeting_location, join_instructions, is_featured, is_active, visibility) VALUES
('a0000000-0000-4000-8000-000000000001', 'Academic Decathlon', 'academic-decathlon', 'Academic competition team covering ten subjects.', 'Competition', ARRAY['academics', 'competition'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'AMC', 'amc', 'American Mathematics Competitions preparation.', 'Math', ARRAY['math', 'AMC'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Ambassador Club', 'ambassador-club', 'Student ambassadors welcoming new students.', 'Leadership', ARRAY['leadership', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Art Club', 'art-club', 'Creative space for visual arts enthusiasts.', 'Arts', ARRAY['art', 'creativity'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Band', 'band', 'Concert and marching band program.', 'Music', ARRAY['music', 'band'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Cheerleading', 'cheerleading', 'School spirit and athletic cheer team.', 'Sports', ARRAY['cheer', 'spirit'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Color Guard / Winter Guard', 'color-guard', 'Performance ensemble with flags and dance.', 'Music', ARRAY['guard', 'performance'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Dance Team', 'dance-team', 'Competitive and performance dance.', 'Sports', ARRAY['dance', 'performance'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Debate', 'debate', 'Competitive debate and public speaking.', 'Competition', ARRAY['debate', 'speaking'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'DECA', 'deca', 'Business and marketing competition club.', 'Leadership', ARRAY['business', 'DECA'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Drama Club', 'drama-club', 'Theater productions and acting workshops.', 'Arts', ARRAY['drama', 'theater'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'E Club', 'e-club', 'Letter winners athletic leadership club.', 'Leadership', ARRAY['athletics', 'leadership'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'FBLA', 'fbla', 'Future Business Leaders of America.', 'Leadership', ARRAY['business', 'FBLA'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'FCCLA', 'fccla', 'Family, Career and Community Leaders.', 'Leadership', ARRAY['FCCLA', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Intramurals', 'intramurals', 'Casual sports and recreation leagues.', 'Sports', ARRAY['sports', 'recreation'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Japanese Club', 'japanese-club', 'Japanese language and culture exploration.', 'Language/Culture', ARRAY['japanese', 'culture'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Journalism', 'journalism', 'School newspaper and media production.', 'Arts', ARRAY['journalism', 'media'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Mock Trial', 'mock-trial', 'Simulated courtroom competition team.', 'Competition', ARRAY['law', 'debate'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'National Honor Society', 'national-honor-society', 'Academic honor society with service requirements.', 'Leadership', ARRAY['NHS', 'service', 'academics'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Olympus Club', 'olympus-club', 'School spirit and community engagement.', 'Leadership', ARRAY['spirit', 'community'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'One Act Play', 'one-act-play', 'Competitive one-act theater productions.', 'Arts', ARRAY['theater', 'competition'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Pep Club', 'pep-club', 'School spirit and game day support.', 'Leadership', ARRAY['spirit', 'pep'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Play Production', 'play-production', 'Full-length theater productions.', 'Arts', ARRAY['theater', 'production'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Power Drive', 'power-drive', 'Electric vehicle design and competition.', 'Engineering', ARRAY['engineering', 'electric'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Quiz Bowl', 'quiz-bowl', 'Academic trivia competition team.', 'Competition', ARRAY['trivia', 'academics'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'SADD', 'sadd', 'Students Against Destructive Decisions.', 'Service', ARRAY['safety', 'service'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Show Choir', 'show-choir', 'Vocal and dance performance ensemble.', 'Music', ARRAY['choir', 'dance', 'music'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Speech', 'speech', 'Competitive speech and oral interpretation.', 'Competition', ARRAY['speech', 'speaking'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Student Council', 'student-council', 'Student government and school leadership.', 'Leadership', ARRAY['government', 'leadership'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Teams +', 'teams-plus', 'Inclusive athletics and activities program.', 'Sports', ARRAY['inclusion', 'sports'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Together We Thrive', 'together-we-thrive', 'Mental health awareness and support.', 'Service', ARRAY['wellness', 'support'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'World Language Club', 'world-language-club', 'Exploring languages and cultures.', 'Language/Culture', ARRAY['language', 'culture'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public'),
('a0000000-0000-4000-8000-000000000001', 'Yearbook', 'yearbook', 'School yearbook design and production.', 'Arts', ARRAY['yearbook', 'media'], 'TBD', 'TBD', 'Contact sponsor', false, true, 'public')
ON CONFLICT (slug) DO NOTHING;

-- Sample Events (using relative dates would need dynamic SQL; using fixed future dates)
INSERT INTO events (school_id, club_id, title, slug, description, event_type, starts_at, ends_at, location, visibility, status) VALUES
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Science Bowl Intro Meeting', 'science-bowl-intro', 'Welcome meeting for new and returning Science Bowl members.', 'meeting', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour', 'Room TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Science Bowl Subject Draft Night', 'science-bowl-draft', 'Subject team assignments and practice planning.', 'meeting', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2 hours', 'Room TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000002', 'Math Club AMC Prep Session', 'math-club-amc-prep', 'AMC 10/12 preparation with practice problems.', 'workshop', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '1.5 hours', 'Room TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000003', 'Robotics Build Session', 'robotics-build', 'Weekly robot build and testing session.', 'meeting', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '3 hours', 'Shop TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000003', 'Robotics Programming Workshop', 'robotics-programming', 'Intro to robot programming and autonomous routines.', 'workshop', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '2 hours', 'Computer Lab TBD', 'members', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Jazz / Music Opportunity Info Session', 'jazz-music-info', 'Learn about band, choir, and music audition opportunities.', 'info_session', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '1 hour', 'Auditorium TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Club Officer Training', 'officer-training', 'Training session for club officers and leaders.', 'workshop', NOW() + INTERVAL '8 days', NOW() + INTERVAL '8 days' + INTERVAL '1 hour', 'Library TBD', 'public', 'approved'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Freshman Opportunity Night', 'freshman-opportunity-night', 'Overview of clubs, sports, and activities for freshmen.', 'info_session', NOW() + INTERVAL '20 days', NOW() + INTERVAL '20 days' + INTERVAL '2 hours', 'Auditorium TBD', 'public', 'approved')
ON CONFLICT DO NOTHING;

-- Sample Opportunities
INSERT INTO opportunities (school_id, club_id, title, slug, summary, description, category, tags, eligibility, grade_min, grade_max, deadline, action_label, status, visibility) VALUES
('a0000000-0000-4000-8000-000000000001', NULL, 'Metro Student Science Fair', 'metro-student-science-fair', 'Present an original science or engineering project to local judges.', 'Register to present an individual or team project at the Metro Student Science Fair.', 'Competition', ARRAY['science', 'research', 'engineering'], 'Open to students in grades 9-12', 9, 12, NOW() + INTERVAL '28 days', 'Register', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Nebraska College Meet and Greet', 'nebraska-college-meet-and-greet', 'Meet admissions representatives from colleges across Nebraska.', 'Learn about programs, scholarships, admissions, and campus life.', 'College', ARRAY['college', 'admissions', 'scholarships'], 'Open to all students and families', 9, 12, NOW() + INTERVAL '18 days', 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Youth Leadership Conference', 'youth-leadership-conference', 'Apply for a one-day student leadership conference.', 'Join students from across the metro for workshops on communication, service, and school leadership.', 'Application', ARRAY['leadership', 'conference'], 'Grades 10-12', 10, 12, NOW() + INTERVAL '21 days', 'Apply', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Peer Tutoring: Chemistry Basics', 'peer-tutoring-chemistry', 'Sign up for student-led chemistry tutoring.', 'Get help with stoichiometry, bonding, and basic chemistry concepts from peer tutors.', 'Workshop', ARRAY['chemistry', 'tutoring'], 'All students', 9, 12, NULL, 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Peer Tutoring: Algebra II / Precalculus', 'peer-tutoring-algebra', 'Sign up for Algebra II and Precalculus support.', 'Student tutors are available for homework help and exam preparation.', 'Workshop', ARRAY['math', 'algebra', 'tutoring'], 'All students', 9, 12, NULL, 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Jazz Band Audition', 'music-audition-reminder', 'Review requirements and register for a jazz band audition.', 'Check audition requirements and sign up for your preferred ensemble.', 'Audition', ARRAY['music', 'audition'], 'All students', 9, 12, NOW() + INTERVAL '14 days', 'Register', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Research Interest Form', 'research-interest', 'Express interest in student research programs.', 'Submit your research interests to connect with mentors and programs.', 'Interest Form', ARRAY['research', 'STEM'], 'Grades 10-12 recommended', 10, 12, NOW() + INTERVAL '60 days', 'Sign Up', 'approved', 'public'),
('a0000000-0000-4000-8000-000000000001', NULL, 'Student-Led Workshop Host Application', 'workshop-host-app', 'Apply to host a peer workshop.', 'Share your knowledge by hosting a student-led workshop on StormHub.', 'Application', ARRAY['workshop', 'leadership'], 'All students', 9, 12, NOW() + INTERVAL '30 days', 'Apply', 'approved', 'public')
ON CONFLICT (slug) DO NOTHING;

-- Sample Workshops
INSERT INTO workshops (school_id, title, description, subject_area, skill_level, starts_at, location, status) VALUES
('a0000000-0000-4000-8000-000000000001', 'Chemistry Basics Tutoring', 'Peer tutoring for stoichiometry and bonding.', 'Chemistry', 'Beginner', NOW() + INTERVAL '4 days', 'Library TBD', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'Algebra II Problem Solving', 'Weekly problem-solving session for Algebra II.', 'Math', 'Intermediate', NOW() + INTERVAL '6 days', 'Room TBD', 'approved'),
('a0000000-0000-4000-8000-000000000001', 'Intro to Python for Robotics', 'Learn Python basics for robot programming.', 'Computer Science', 'Beginner', NOW() + INTERVAL '9 days', 'Computer Lab TBD', 'approved')
ON CONFLICT DO NOTHING;

-- Sample Announcements for featured clubs
INSERT INTO club_announcements (club_id, author_id, title, body, visibility, status, published_at) VALUES
('c0000001-0000-4000-8000-000000000001', NULL, 'Welcome to Science Bowl!', 'Practice schedules will be posted soon. Join to stay updated on tryouts and subject teams.', 'public', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000001', NULL, 'Subject Team Assignments Posted', 'Check the member resources page for your subject team assignment and practice schedule.', 'members', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000002', NULL, 'AMC Registration Open', 'AMC 10/12 registration is now open. See member resources for sign-up links.', 'members', 'approved', NOW()),
('c0000001-0000-4000-8000-000000000003', NULL, 'Build Season Kickoff', 'Build season starts this week! Check the build schedule in member resources.', 'members', 'approved', NOW())
ON CONFLICT DO NOTHING;

-- Member-only club resources (Science Bowl)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000001', NULL, 'Practice Schedule', 'Weekly practice times and locations', 'text', 'Practices TBD — check announcements for updates when school resumes.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Subject Assignments', 'Your subject team assignment', 'text', 'Subject teams will be assigned after tryouts.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Biology Resources', 'Study materials for biology', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Chemistry Resources', 'Study materials for chemistry', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Physics Resources', 'Study materials for physics', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Earth Science Resources', 'Study materials for earth science', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Astronomy Resources', 'Study materials for astronomy', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Math Resources', 'Study materials for math', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000001', NULL, 'Mock Round Guidelines', 'How mock rounds work', 'text', 'Mock rounds follow official Science Bowl rules. Buzz in when you know the answer.', NULL, 'members', 'approved')
ON CONFLICT DO NOTHING;

-- Member-only club resources (Math Club)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000002', NULL, 'AMC/AIME Resources', 'Contest preparation materials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Weekly Problem Set', 'This week problems', 'text', 'Problem set posted weekly — check back Monday.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Contest Calendar', 'Upcoming math contests', 'text', 'AMC 10/12: November | AIME: February | State Math Contest: March', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000002', NULL, 'Topic Groups', 'Study group sign-ups', 'text', 'Algebra, Geometry, Combinatorics, Number Theory, Probability groups forming.', NULL, 'members', 'approved')
ON CONFLICT DO NOTHING;

-- Member-only club resources (Robotics)
INSERT INTO club_resources (club_id, author_id, title, description, resource_type, content, url, visibility, status) VALUES
('c0000001-0000-4000-8000-000000000003', NULL, 'Build Schedule', 'Weekly build sessions', 'text', 'Build sessions TBD — see announcements when school resumes.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Programming Resources', 'Code templates and tutorials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'CAD/Design Resources', 'Design files and tutorials', 'link', NULL, '#', 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Tournament Preparation', 'Competition checklist', 'text', 'Pre-tournament checklist: robot inspection, autonomous tested, spare parts packed.', NULL, 'members', 'approved'),
('c0000001-0000-4000-8000-000000000003', NULL, 'Engineering Notebook Resources', 'Notebook templates and guidelines', 'link', NULL, '#', 'members', 'approved')
ON CONFLICT DO NOTHING;
