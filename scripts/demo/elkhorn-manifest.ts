export const ELKHORN_DEMO_VERSION = "2026-08-19.1";
export const DEMO_EMAIL_DOMAIN = "demo.stormhubapp.com";

export function demoUuid(sequence: number): string {
  return `e1c00000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

export const DEMO_IDS = {
  district: demoUuid(1),
  schools: {
    south: demoUuid(10),
    high: demoUuid(11),
    north: demoUuid(12),
  },
  clubs: {
    robotics: demoUuid(100),
    service: demoUuid(101),
    debate: demoUuid(102),
    environment: demoUuid(103),
    business: demoUuid(104),
    health: demoUuid(105),
    culture: demoUuid(106),
    jazz: demoUuid(107),
    council: demoUuid(108),
    photography: demoUuid(109),
    highQuiz: demoUuid(120),
    highCoding: demoUuid(121),
    highArt: demoUuid(122),
    highEducators: demoUuid(123),
    northScience: demoUuid(130),
    northKey: demoUuid(131),
    northWriting: demoUuid(132),
    northEsports: demoUuid(133),
  },
  announcements: {
    roboticsDraft: demoUuid(200),
    roboticsPublished: demoUuid(201),
    activitiesFair: demoUuid(202),
    service: demoUuid(203),
    debate: demoUuid(204),
    high: demoUuid(205),
    north: demoUuid(206),
    scheduled: demoUuid(207),
  },
  events: {
    roboticsLab: demoUuid(300),
    activitiesFair: demoUuid(301),
    serviceKickoff: demoUuid(302),
    debateInfo: demoUuid(303),
    jazzInterest: demoUuid(304),
    highCoding: demoUuid(305),
    highQuiz: demoUuid(306),
    northScience: demoUuid(307),
    northKey: demoUuid(308),
  },
  opportunities: {
    fairCrew: demoUuid(400),
    stemMentor: demoUuid(401),
    cleanup: demoUuid(402),
    photography: demoUuid(403),
    tutoring: demoUuid(404),
    expired: demoUuid(405),
  },
  assignment: demoUuid(500),
  submission: demoUuid(501),
  resource: demoUuid(502),
  snapshotAudit: demoUuid(900),
} as const;

export type DemoSchoolKey = keyof typeof DEMO_IDS.schools;
export type DemoAccountRole = "student" | "teacher" | "admin" | "district_admin";

export type DemoAccount = {
  key: string;
  email: string;
  fullName: string;
  role: DemoAccountRole;
  school: DemoSchoolKey;
  gradeLevel?: number;
  purpose: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: "dana", email: `dana.mitchell@${DEMO_EMAIL_DOMAIN}`, fullName: "Dana Mitchell", role: "district_admin", school: "south", purpose: "District-scoped administration across the three demo schools" },
  { key: "alex", email: `alex.morgan@${DEMO_EMAIL_DOMAIN}`, fullName: "Alex Morgan", role: "admin", school: "south", purpose: "Activities-office club approval, people, roles, and statistics" },
  { key: "elena", email: `elena.carter@${DEMO_EMAIL_DOMAIN}`, fullName: "Elena Carter", role: "teacher", school: "south", purpose: "Engineering & Robotics Advisor and staff moderation" },
  { key: "jordan", email: `jordan.lee@${DEMO_EMAIL_DOMAIN}`, fullName: "Jordan Lee", role: "student", school: "south", gradeLevel: 11, purpose: "Engineering & Robotics President and student leader" },
  { key: "maya", email: `maya.patel@${DEMO_EMAIL_DOMAIN}`, fullName: "Maya Patel", role: "student", school: "south", gradeLevel: 10, purpose: "Student discovery, memberships, RSVPs, and opportunities" },
  { key: "sofia", email: `sofia.ramirez@${DEMO_EMAIL_DOMAIN}`, fullName: "Sofia Ramirez", role: "student", school: "south", gradeLevel: 11, purpose: "Engineering & Robotics Vice President" },
  { key: "noah", email: `noah.williams@${DEMO_EMAIL_DOMAIN}`, fullName: "Noah Williams", role: "student", school: "south", gradeLevel: 10, purpose: "Engineering & Robotics Secretary represented by the Vice President permission tier" },
  { key: "priya", email: `priya.nair@${DEMO_EMAIL_DOMAIN}`, fullName: "Priya Nair", role: "teacher", school: "south", purpose: "Community Service Advisor" },
  { key: "marcus", email: `marcus.reed@${DEMO_EMAIL_DOMAIN}`, fullName: "Marcus Reed", role: "teacher", school: "south", purpose: "Speech & Debate Advisor" },
  { key: "aisha", email: `aisha.thompson@${DEMO_EMAIL_DOMAIN}`, fullName: "Aisha Thompson", role: "teacher", school: "south", purpose: "Environmental Action Advisor" },
  { key: "evan", email: `evan.kim@${DEMO_EMAIL_DOMAIN}`, fullName: "Evan Kim", role: "teacher", school: "south", purpose: "Business & Entrepreneurship Advisor" },
  { key: "renee", email: `renee.flores@${DEMO_EMAIL_DOMAIN}`, fullName: "Renee Flores", role: "teacher", school: "south", purpose: "Health Careers Advisor" },
  { key: "lydia", email: `lydia.park@${DEMO_EMAIL_DOMAIN}`, fullName: "Lydia Park", role: "teacher", school: "south", purpose: "International Culture Advisor" },
  { key: "omar", email: `omar.davis@${DEMO_EMAIL_DOMAIN}`, fullName: "Omar Davis", role: "teacher", school: "south", purpose: "Jazz Ensemble Advisor" },
  { key: "claire", email: `claire.bennett@${DEMO_EMAIL_DOMAIN}`, fullName: "Claire Bennett", role: "teacher", school: "south", purpose: "Student Council Advisor" },
  { key: "riley", email: `riley.quinn@${DEMO_EMAIL_DOMAIN}`, fullName: "Riley Quinn", role: "student", school: "south", gradeLevel: 9, purpose: "Robotics and Health Careers member" },
  { key: "casey", email: `casey.nguyen@${DEMO_EMAIL_DOMAIN}`, fullName: "Casey Nguyen", role: "student", school: "south", gradeLevel: 12, purpose: "Debate and Student Council member" },
  { key: "avery", email: `avery.johnson@${DEMO_EMAIL_DOMAIN}`, fullName: "Avery Johnson", role: "student", school: "south", gradeLevel: 10, purpose: "Community Service and Environmental Action member" },
  { key: "sam", email: `sam.rivera@${DEMO_EMAIL_DOMAIN}`, fullName: "Sam Rivera", role: "student", school: "south", gradeLevel: 11, purpose: "Business and International Culture member" },
  { key: "taylor", email: `taylor.brooks@${DEMO_EMAIL_DOMAIN}`, fullName: "Taylor Brooks", role: "admin", school: "high", purpose: "Elkhorn High demo school administrator" },
  { key: "jamie", email: `jamie.foster@${DEMO_EMAIL_DOMAIN}`, fullName: "Jamie Foster", role: "teacher", school: "high", purpose: "Elkhorn High club Advisor" },
  { key: "cameron", email: `cameron.wells@${DEMO_EMAIL_DOMAIN}`, fullName: "Cameron Wells", role: "teacher", school: "high", purpose: "Elkhorn High club Advisor" },
  { key: "devon", email: `devon.price@${DEMO_EMAIL_DOMAIN}`, fullName: "Devon Price", role: "student", school: "high", gradeLevel: 10, purpose: "Elkhorn High student member" },
  { key: "harper", email: `harper.bell@${DEMO_EMAIL_DOMAIN}`, fullName: "Harper Bell", role: "student", school: "high", gradeLevel: 11, purpose: "Elkhorn High student leader" },
  { key: "morgan", email: `morgan.chen@${DEMO_EMAIL_DOMAIN}`, fullName: "Morgan Chen", role: "admin", school: "north", purpose: "Elkhorn North demo school administrator" },
  { key: "rowan", email: `rowan.ellis@${DEMO_EMAIL_DOMAIN}`, fullName: "Rowan Ellis", role: "teacher", school: "north", purpose: "Elkhorn North club Advisor" },
  { key: "skyler", email: `skyler.james@${DEMO_EMAIL_DOMAIN}`, fullName: "Skyler James", role: "teacher", school: "north", purpose: "Elkhorn North club Advisor" },
  { key: "quinn", email: `quinn.adams@${DEMO_EMAIL_DOMAIN}`, fullName: "Quinn Adams", role: "student", school: "north", gradeLevel: 9, purpose: "Elkhorn North student member" },
  { key: "emery", email: `emery.stone@${DEMO_EMAIL_DOMAIN}`, fullName: "Emery Stone", role: "student", school: "north", gradeLevel: 12, purpose: "Elkhorn North student leader" },
];

export const DEMO_DISTRICT = {
  id: DEMO_IDS.district,
  name: "Elkhorn Public Schools — DEMO",
  slug: "elkhorn-public-schools-demo",
  description: "Synthetic StormHub demonstration tenant; not an official EPS deployment.",
  city: "Fictional Demo",
  state: "NE",
  website_url: null,
  is_active: true,
};

export const DEMO_SCHOOLS = [
  { key: "south" as const, id: DEMO_IDS.schools.south, name: "Elkhorn South High School — DEMO", short_name: "South Demo", slug: "elkhorn-south-demo", mascot: "Demo Storm" },
  { key: "high" as const, id: DEMO_IDS.schools.high, name: "Elkhorn High School — DEMO", short_name: "High Demo", slug: "elkhorn-high-demo", mascot: "Demo Antlers" },
  { key: "north" as const, id: DEMO_IDS.schools.north, name: "Elkhorn North High School — DEMO", short_name: "North Demo", slug: "elkhorn-north-demo", mascot: "Demo Wolves" },
].map((school) => ({
  ...school,
  district_id: DEMO_IDS.district,
  city: "Fictional Demo",
  state: "NE",
  allowed_email_domains: [DEMO_EMAIL_DOMAIN],
  is_active: true,
  is_public: true,
  logo_url: null,
}));

type DemoClub = {
  key: keyof typeof DEMO_IDS.clubs;
  school: DemoSchoolKey;
  name: string;
  slug: string;
  category: string;
  short: string;
  description: string;
  meeting: string;
  location: string;
  advisor?: string;
  featured?: boolean;
  draft?: boolean;
};

export const DEMO_CLUBS: DemoClub[] = [
  { key: "robotics", school: "south", name: "Engineering & Robotics Club", slug: "demo-engineering-robotics", category: "STEM", short: "Design, build, code, and test student engineering projects.", description: "A collaborative engineering community where students prototype robots, learn practical design skills, and prepare demonstrations for school events.", meeting: "Thursdays, 3:30–5:00 PM", location: "Room 214", advisor: "elena", featured: true },
  { key: "service", school: "south", name: "Community Service Club", slug: "demo-community-service", category: "Service", short: "Plan meaningful volunteer projects with local partners.", description: "Students organize accessible service projects, track participation, and build partnerships that strengthen the fictional demo community.", meeting: "Tuesdays, 3:25–4:15 PM", location: "Room 118", advisor: "priya" },
  { key: "debate", school: "south", name: "Speech & Debate Club", slug: "demo-speech-debate", category: "Academic", short: "Practice public speaking, argumentation, and competition skills.", description: "Members build confidence through structured speaking practice, collaborative case preparation, and friendly tournaments.", meeting: "Wednesdays, 3:30–5:00 PM", location: "Room 306", advisor: "marcus" },
  { key: "environment", school: "south", name: "Environmental Action Club", slug: "demo-environmental-action", category: "Service", short: "Lead practical sustainability projects at school.", description: "Students turn environmental ideas into measurable campus projects, awareness events, and community action.", meeting: "First and third Mondays", location: "Room 221", advisor: "aisha" },
  { key: "business", school: "south", name: "Business & Entrepreneurship Club", slug: "demo-business-entrepreneurship", category: "Career", short: "Explore product ideas, teamwork, and student enterprise.", description: "Members practice customer discovery, pitching, budgeting, and ethical decision-making through hands-on challenges.", meeting: "Tuesdays, 3:30–4:30 PM", location: "Room 128", advisor: "evan" },
  { key: "health", school: "south", name: "Health Careers Club", slug: "demo-health-careers", category: "Career", short: "Discover health professions through speakers and activities.", description: "Students explore health-care pathways, practice professional skills, and meet fictional guest speakers in the demo environment.", meeting: "Second Thursday monthly", location: "Room 202", advisor: "renee" },
  { key: "culture", school: "south", name: "International Culture Club", slug: "demo-international-culture", category: "Culture", short: "Celebrate languages, traditions, food, and global perspectives.", description: "A welcoming space for students to share cultural knowledge and plan inclusive school activities.", meeting: "Fridays, 3:20–4:10 PM", location: "Room 115", advisor: "lydia" },
  { key: "jazz", school: "south", name: "Jazz Ensemble Club", slug: "demo-jazz-ensemble", category: "Arts", short: "Rehearse jazz repertoire and develop ensemble skills.", description: "Student musicians rehearse standards, improvise together, and prepare informal performances.", meeting: "Mondays, 3:30–5:00 PM", location: "Music Room", advisor: "omar" },
  { key: "council", school: "south", name: "Student Council", slug: "demo-student-council", category: "Leadership", short: "Coordinate student voice and schoolwide activities.", description: "Student representatives plan inclusive events, gather feedback, and communicate participation opportunities.", meeting: "Wednesdays before school", location: "Commons Conference Room", advisor: "claire" },
  { key: "photography", school: "south", name: "Photography Club", slug: "demo-photography", category: "Arts", short: "Learn composition and document student activities.", description: "A proposed club for students interested in photography, visual storytelling, and event coverage.", meeting: "To be determined", location: "To be assigned", draft: true },
  { key: "highQuiz", school: "high", name: "Academic Quiz Bowl", slug: "demo-high-quiz-bowl", category: "Academic", short: "Team trivia and academic competition.", description: "Students prepare collaboratively for fast-paced academic competitions.", meeting: "Mondays after school", location: "Room 104", advisor: "jamie" },
  { key: "highCoding", school: "high", name: "Coding Collective", slug: "demo-high-coding", category: "STEM", short: "Build software projects with peers.", description: "A friendly coding group for project practice and peer mentoring.", meeting: "Thursdays after school", location: "Lab 2", advisor: "cameron" },
  { key: "highArt", school: "high", name: "Art Society", slug: "demo-high-art", category: "Arts", short: "Create and share student artwork.", description: "Members explore media, critique work constructively, and plan displays.", meeting: "Tuesdays after school", location: "Art Studio", advisor: "jamie" },
  { key: "highEducators", school: "high", name: "Future Educators", slug: "demo-high-future-educators", category: "Career", short: "Explore careers in teaching and youth leadership.", description: "Students practice mentoring and learn about education careers.", meeting: "Second Wednesday monthly", location: "Room 210", advisor: "cameron" },
  { key: "northScience", school: "north", name: "Science Olympiad", slug: "demo-north-science-olympiad", category: "STEM", short: "Prepare for team science challenges.", description: "Students investigate science topics and build competition-ready projects.", meeting: "Tuesdays after school", location: "Science Lab", advisor: "rowan" },
  { key: "northKey", school: "north", name: "Key Club", slug: "demo-north-key-club", category: "Service", short: "Organize student-led service projects.", description: "Members coordinate approachable volunteer activities for the demo community.", meeting: "First Thursday monthly", location: "Room 132", advisor: "skyler" },
  { key: "northWriting", school: "north", name: "Creative Writing Club", slug: "demo-north-creative-writing", category: "Arts", short: "Write, workshop, and publish creative work.", description: "A supportive group for fiction, poetry, and student publishing.", meeting: "Fridays after school", location: "Library Seminar Room", advisor: "rowan" },
  { key: "northEsports", school: "north", name: "Esports Club", slug: "demo-north-esports", category: "Recreation", short: "Practice teamwork through organized competitive games.", description: "Students focus on communication, strategy, and responsible competition.", meeting: "Wednesdays after school", location: "Media Lab", advisor: "skyler" },
];

export const PRIMARY_DEMO_ACCOUNT_KEYS = ["dana", "alex", "elena", "jordan", "maya"] as const;
