import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { assertElkhornDemoSeedEnvironment } from "../../lib/demo-environment";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../lib/env";
import {
  ACCEPTABLE_USE_VERSION,
  HIGH_SCHOOL_AGE_ASSURANCE,
  POLICY_ACCEPTANCE_METADATA,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "../../lib/policy";
import {
  DEMO_ACCOUNTS,
  DEMO_CLUBS,
  DEMO_DISTRICT,
  DEMO_EMAIL_DOMAIN,
  DEMO_IDS,
  DEMO_SCHOOLS,
  ELKHORN_DEMO_VERSION,
  demoUuid,
  type DemoSchoolKey,
} from "./elkhorn-manifest";

type AdminClient = SupabaseClient;
type DemoCommand = "seed" | "verify" | "reset";
type UserIdMap = Map<string, string>;

const DEMO_SCHOOL_IDS = Object.values(DEMO_IDS.schools);
const DEMO_CLUB_IDS = Object.values(DEMO_IDS.clubs);
const DEMO_ANNOUNCEMENT_IDS = Object.values(DEMO_IDS.announcements);
const DEMO_EVENT_IDS = Object.values(DEMO_IDS.events);
const DEMO_OPPORTUNITY_IDS = Object.values(DEMO_IDS.opportunities);
const DEMO_ENTITY_IDS = [
  DEMO_IDS.district,
  ...DEMO_SCHOOL_IDS,
  ...DEMO_CLUB_IDS,
  ...DEMO_ANNOUNCEMENT_IDS,
  ...DEMO_EVENT_IDS,
  ...DEMO_OPPORTUNITY_IDS,
  DEMO_IDS.assignment,
  DEMO_IDS.submission,
  DEMO_IDS.resource,
];

function fail(message: string): never {
  throw new Error(message);
}

function requireNoError(error: { message: string } | null, context: string): void {
  if (error) fail(`${context}: ${error.message}`);
}

function daysFromNowInChicago(days: number, hour: number, minute = 0): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  const targetWallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) + days,
    hour,
    minute,
    0
  );
  let candidate = new Date(targetWallClock);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = Object.fromEntries(
      formatter.formatToParts(candidate).map((part) => [part.type, part.value])
    );
    const renderedWallClock = Date.UTC(
      Number(rendered.year),
      Number(rendered.month) - 1,
      Number(rendered.day),
      Number(rendered.hour),
      Number(rendered.minute),
      Number(rendered.second)
    );
    candidate = new Date(candidate.getTime() + (targetWallClock - renderedWallClock));
  }
  return candidate.toISOString();
}

async function assertRequiredSchema(admin: AdminClient): Promise<void> {
  const requirements = [
    ["districts", "id,slug,description,access_disabled_at"],
    ["schools", "id,district_id,allowed_email_domains,access_disabled_at"],
    ["school_settings", "school_id,email_sending_enabled,student_content_requires_staff_approval"],
    ["profiles", "id,school_id,district_id,role,account_status,onboarding_reset_at"],
    ["clubs", "id,school_id,status,is_listed,is_featured,is_active"],
    ["club_memberships", "club_id,user_id,status,role"],
    ["club_announcements", "id,club_id,author_id,status,scheduled_for"],
    ["approval_requests", "id,school_id,content_type,content_id,status"],
    ["events", "id,school_id,club_id,starts_at,status"],
    ["event_rsvps", "event_id,user_id,status"],
    ["opportunities", "id,school_id,status,eligible_grades"],
    ["opportunity_signups", "opportunity_id,user_id,status"],
    ["club_assignments", "id,club_id,status,submission_mode,scheduled_for"],
    ["club_assignment_submissions", "id,assignment_id,student_id,status"],
    ["notifications", "id,recipient_user_id,type"],
    ["analytics_events", "id,school_id,user_id,event_type"],
    ["admin_audit_log", "id,school_id,actor_user_id,action,new_data"],
    ["school_signup_access", "school_id,access_code"],
    ["policy_acceptances", "user_id,privacy_version,age_assurance"],
  ] as const;

  for (const [table, columns] of requirements) {
    const { error } = await admin.from(table).select(columns).limit(1);
    if (error) {
      fail(
        `Demo schema is missing ${table} (${columns}). Apply all migrations, including `
        + `20260819120000_school_student_content_moderation.sql. Provider message: ${error.message}`
      );
    }
  }
}

async function getSuperAdminIds(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .order("id");
  requireNoError(error, "Could not snapshot platform super administrators");
  return (data ?? []).map((row) => String(row.id));
}

function assertTwoSuperAdmins(ids: string[]): void {
  if (ids.length !== 2) {
    fail(
      `Expected exactly two existing platform super-administrator profiles before demo mutation; found ${ids.length}. `
      + "No demo records were intentionally changed."
    );
  }
}

async function upsertRows(
  admin: AdminClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id"
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  requireNoError(error, `Could not upsert ${table}`);
}

async function deleteByIds(admin: AdminClient, table: string, column: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in(column, ids);
  requireNoError(error, `Could not reset ${table}`);
}

async function listAuthUsers(admin: AdminClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    requireNoError(error, "Could not list demo authentication users");
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function ensureDemoUsers(
  admin: AdminClient,
  password: string
): Promise<UserIdMap> {
  const existingUsers = await listAuthUsers(admin);
  const byEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user])
  );
  const userIds: UserIdMap = new Map();

  for (const account of DEMO_ACCOUNTS) {
    const schoolId = DEMO_IDS.schools[account.school];
    const schoolCode = {
      south: "SH-DE00-A001-2026",
      high: "SH-DE00-A002-2026",
      north: "SH-DE00-A003-2026",
    }[account.school];
    const metadata = {
      full_name: account.fullName,
      school_id: schoolId,
      school_access_code: schoolCode,
      grade_level: account.gradeLevel?.toString() ?? "",
      [POLICY_ACCEPTANCE_METADATA.privacy]: PRIVACY_POLICY_VERSION,
      [POLICY_ACCEPTANCE_METADATA.terms]: TERMS_VERSION,
      [POLICY_ACCEPTANCE_METADATA.acceptableUse]: ACCEPTABLE_USE_VERSION,
      [POLICY_ACCEPTANCE_METADATA.ageAssurance]: HIGH_SCHOOL_AGE_ASSURANCE,
      stormhub_demo_account: true,
      stormhub_demo_version: ELKHORN_DEMO_VERSION,
    };
    let user = byEmail.get(account.email.toLowerCase());
    if (user && user.user_metadata?.stormhub_demo_account !== true) {
      fail(
        `Refusing to modify existing authentication user ${account.email} because it was not created by the Elkhorn demo seed.`
      );
    }
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      requireNoError(error, `Could not create ${account.email}`);
      if (!data.user) fail(`Authentication did not return a user for ${account.email}.`);
      user = data.user;
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { ...user.user_metadata, ...metadata },
      });
      requireNoError(error, `Could not refresh ${account.email}`);
      if (!data.user) fail(`Authentication update did not return a user for ${account.email}.`);
      user = data.user;
    }
    if (!user) fail(`Authentication user resolution failed for ${account.email}.`);
    userIds.set(account.key, user.id);
  }
  return userIds;
}

function userId(users: UserIdMap, key: string): string {
  return users.get(key) ?? fail(`Missing seeded user key: ${key}`);
}

function schoolId(key: DemoSchoolKey): string {
  return DEMO_IDS.schools[key];
}

async function writeSeedMarker(admin: AdminClient, superAdminIds: string[], status: "seeding" | "complete") {
  await upsertRows(admin, "admin_audit_log", [{
    id: DEMO_IDS.snapshotAudit,
    school_id: null,
    actor_user_id: null,
    action: "elkhorn_demo_seed_snapshot",
    entity_type: "demo_environment",
    entity_id: DEMO_IDS.district,
    old_data: {
      superAdminCount: superAdminIds.length,
      superAdminIds,
    },
    new_data: {
      version: ELKHORN_DEMO_VERSION,
      status,
      fictionalDataOnly: true,
      outboundEmailSuppressed: true,
    },
    occurred_at: new Date().toISOString(),
  }]);
}

async function seed(admin: AdminClient, password: string): Promise<void> {
  await assertRequiredSchema(admin);
  const superAdminIdsBefore = await getSuperAdminIds(admin);
  assertTwoSuperAdmins(superAdminIdsBefore);
  await writeSeedMarker(admin, superAdminIdsBefore, "seeding");

  await upsertRows(admin, "districts", [DEMO_DISTRICT]);
  await upsertRows(admin, "schools", DEMO_SCHOOLS.map(({ key: _key, ...school }) => school));
  await upsertRows(admin, "school_settings", DEMO_SCHOOLS.map((school) => ({
    school_id: school.id,
    announcements_enabled: true,
    events_enabled: true,
    resources_enabled: true,
    opportunities_enabled: true,
    volunteering_enabled: false,
    workshops_enabled: false,
    email_sending_enabled: false,
    student_content_requires_staff_approval: school.key === "south",
  })), "school_id");
  await upsertRows(admin, "school_signup_access", [
    { school_id: DEMO_IDS.schools.south, access_code: "SH-DE00-A001-2026", rotated_by: null },
    { school_id: DEMO_IDS.schools.high, access_code: "SH-DE00-A002-2026", rotated_by: null },
    { school_id: DEMO_IDS.schools.north, access_code: "SH-DE00-A003-2026", rotated_by: null },
  ], "school_id");

  const users = await ensureDemoUsers(admin, password);
  const oldProfileDate = daysFromNowInChicago(-120, 12);
  await upsertRows(admin, "profiles", DEMO_ACCOUNTS.map((account) => ({
    id: userId(users, account.key),
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    school_id: account.role === "district_admin" ? null : schoolId(account.school),
    district_id: DEMO_IDS.district,
    grade_level: account.gradeLevel ?? null,
    account_status: "active",
    onboarding_reset_at: null,
    created_at: oldProfileDate,
    updated_at: new Date().toISOString(),
  })));

  await upsertRows(admin, "policy_acceptances", DEMO_ACCOUNTS.map((account) => ({
    user_id: userId(users, account.key),
    school_id: account.role === "district_admin" ? null : schoolId(account.school),
    privacy_version: PRIVACY_POLICY_VERSION,
    terms_version: TERMS_VERSION,
    acceptable_use_version: ACCEPTABLE_USE_VERSION,
    age_assurance: HIGH_SCHOOL_AGE_ASSURANCE,
    source: "existing_user",
    accepted_at: oldProfileDate,
  })), "user_id,privacy_version,terms_version,acceptable_use_version");
  await upsertRows(admin, "notification_preferences", DEMO_ACCOUNTS.map((account) => ({
    user_id: userId(users, account.key),
    in_app_enabled: true,
    club_updates_enabled: true,
    opportunity_deadlines_enabled: true,
    important_email_enabled: false,
    urgent_email_enabled: false,
    admin_attention_email_enabled: false,
    weekly_digest_enabled: false,
  })), "user_id");

  const clubs = DEMO_CLUBS.map((club) => {
    const advisor = club.advisor ? DEMO_ACCOUNTS.find((account) => account.key === club.advisor) : null;
    return {
      id: DEMO_IDS.clubs[club.key],
      school_id: schoolId(club.school),
      name: club.name,
      slug: club.slug,
      short_description: club.short,
      long_description: club.description,
      category: club.category,
      tags: [club.category.toLowerCase(), "fictional-demo"],
      sponsor_name: advisor?.fullName ?? null,
      sponsor_email: advisor?.email ?? null,
      meeting_time: club.meeting,
      meeting_location: club.location,
      join_instructions: "Open the club page and choose Join club.",
      status: club.draft ? "draft" : "active",
      is_listed: !club.draft,
      is_featured: Boolean(club.featured),
      is_active: !club.draft,
      visibility: club.draft ? "unlisted" : "public",
    };
  });
  await upsertRows(admin, "clubs", clubs);

  const membershipPlan: Array<[keyof typeof DEMO_IDS.clubs, string, "member" | "officer" | "president" | "sponsor"]> = [
    ["robotics", "elena", "sponsor"], ["robotics", "jordan", "president"], ["robotics", "sofia", "officer"], ["robotics", "noah", "officer"], ["robotics", "maya", "member"], ["robotics", "riley", "member"], ["robotics", "casey", "member"],
    ["service", "priya", "sponsor"], ["service", "maya", "member"], ["service", "avery", "president"], ["service", "sam", "member"],
    ["debate", "marcus", "sponsor"], ["debate", "casey", "president"], ["debate", "maya", "member"],
    ["environment", "aisha", "sponsor"], ["environment", "avery", "member"], ["environment", "riley", "member"],
    ["business", "evan", "sponsor"], ["business", "sam", "president"], ["business", "jordan", "member"],
    ["health", "renee", "sponsor"], ["health", "riley", "member"], ["health", "maya", "member"],
    ["culture", "lydia", "sponsor"], ["culture", "sam", "member"], ["culture", "sofia", "member"],
    ["jazz", "omar", "sponsor"], ["jazz", "noah", "member"], ["jazz", "casey", "member"],
    ["council", "claire", "sponsor"], ["council", "jordan", "member"], ["council", "casey", "officer"],
    ["highQuiz", "jamie", "sponsor"], ["highQuiz", "harper", "president"], ["highQuiz", "devon", "member"],
    ["highCoding", "cameron", "sponsor"], ["highCoding", "devon", "member"], ["highCoding", "harper", "member"],
    ["highArt", "jamie", "sponsor"], ["highArt", "devon", "member"],
    ["highEducators", "cameron", "sponsor"], ["highEducators", "harper", "member"],
    ["northScience", "rowan", "sponsor"], ["northScience", "emery", "president"], ["northScience", "quinn", "member"],
    ["northKey", "skyler", "sponsor"], ["northKey", "quinn", "member"], ["northKey", "emery", "member"],
    ["northWriting", "rowan", "sponsor"], ["northWriting", "quinn", "member"],
    ["northEsports", "skyler", "sponsor"], ["northEsports", "emery", "member"],
  ];
  await upsertRows(admin, "club_memberships", membershipPlan.map(([club, account, role], index) => ({
    id: demoUuid(2000 + index),
    club_id: DEMO_IDS.clubs[club],
    user_id: userId(users, account),
    status: "active",
    role,
    joined_at: daysFromNowInChicago(-45 + (index % 15), 15),
  })), "club_id,user_id");

  const now = new Date().toISOString();
  await upsertRows(admin, "club_announcements", [
    { id: DEMO_IDS.announcements.roboticsDraft, club_id: DEMO_IDS.clubs.robotics, author_id: userId(users, "jordan"), title: "Robotics Open Lab — Room Update", body: "Our open lab will meet in Room 214 this Thursday after school. New members are welcome. Please RSVP so we can prepare enough workstations.", visibility: "members", status: "draft", importance: "important", send_email_to_members: false, published_at: null, scheduled_for: null },
    { id: DEMO_IDS.announcements.roboticsPublished, club_id: DEMO_IDS.clubs.robotics, author_id: userId(users, "elena"), title: "Build Team Orientation", body: "New and returning members can review safety stations and choose a fall build team at Thursday's meeting.", visibility: "members", status: "approved", importance: "normal", send_email_to_members: false, published_at: daysFromNowInChicago(-2, 15) },
    { id: DEMO_IDS.announcements.activitiesFair, club_id: DEMO_IDS.clubs.council, author_id: userId(users, "claire"), title: "Fall Activities Fair", body: "Explore student organizations, meet club leaders, and learn how to participate this Friday after school in the commons.", visibility: "public", status: "approved", importance: "important", send_email_to_members: false, published_at: daysFromNowInChicago(-1, 10) },
    { id: DEMO_IDS.announcements.service, club_id: DEMO_IDS.clubs.service, author_id: userId(users, "priya"), title: "Service Project Sign-up", body: "Choose a kickoff team before Tuesday so project leads can prepare materials.", visibility: "members", status: "approved", importance: "normal", send_email_to_members: false, published_at: daysFromNowInChicago(-3, 15) },
    { id: DEMO_IDS.announcements.debate, club_id: DEMO_IDS.clubs.debate, author_id: userId(users, "marcus"), title: "Practice Topics Posted", body: "This week's speaking prompts and partner groups are ready in the club workspace.", visibility: "members", status: "approved", importance: "normal", send_email_to_members: false, published_at: daysFromNowInChicago(-4, 16) },
    { id: DEMO_IDS.announcements.high, club_id: DEMO_IDS.clubs.highCoding, author_id: userId(users, "cameron"), title: "Project Teams Forming", body: "Bring one project idea to Thursday's Coding Collective meeting.", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false, published_at: daysFromNowInChicago(-2, 14) },
    { id: DEMO_IDS.announcements.north, club_id: DEMO_IDS.clubs.northScience, author_id: userId(users, "rowan"), title: "Science Event Choices", body: "Members can rank their preferred Science Olympiad events in the member workspace.", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false, published_at: daysFromNowInChicago(-2, 14) },
    { id: DEMO_IDS.announcements.scheduled, club_id: DEMO_IDS.clubs.robotics, author_id: userId(users, "elena"), title: "Competition Interest Check", body: "A short competition interest form will open next week.", visibility: "members", status: "draft", importance: "normal", send_email_to_members: false, published_at: null, scheduled_for: daysFromNowInChicago(4, 8) },
  ]);
  await admin.from("approval_requests").delete().eq("content_type", "announcement").eq("content_id", DEMO_IDS.announcements.roboticsDraft);

  const eventRows = [
    { id: DEMO_IDS.events.roboticsLab, school_id: schoolId("south"), club_id: DEMO_IDS.clubs.robotics, created_by: userId(users, "elena"), title: "Robotics New-Member Open Lab", slug: "demo-robotics-open-lab", description: "Tour the workspace, try a beginner build station, and meet the student engineering teams.", event_type: "meeting", starts_at: daysFromNowInChicago(3, 15, 30), ends_at: daysFromNowInChicago(3, 17), location: "Room 214", visibility: "public", status: "approved", importance: "important", send_email_to_members: false },
    { id: DEMO_IDS.events.activitiesFair, school_id: schoolId("south"), club_id: DEMO_IDS.clubs.council, created_by: userId(users, "claire"), title: "Fall Activities Fair", slug: "demo-fall-activities-fair", description: "Meet club leaders and find ways to participate.", event_type: "other", starts_at: daysFromNowInChicago(5, 15, 30), ends_at: daysFromNowInChicago(5, 17), location: "Commons", visibility: "public", status: "approved", importance: "important", send_email_to_members: false },
    { id: DEMO_IDS.events.serviceKickoff, school_id: schoolId("south"), club_id: DEMO_IDS.clubs.service, created_by: userId(users, "priya"), title: "Community Service Kickoff", slug: "demo-community-service-kickoff", description: "Choose a fall service team and review project timelines.", event_type: "info_session", starts_at: daysFromNowInChicago(7, 15, 30), ends_at: daysFromNowInChicago(7, 16, 30), location: "Room 118", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.debateInfo, school_id: schoolId("south"), club_id: DEMO_IDS.clubs.debate, created_by: userId(users, "marcus"), title: "Speech & Debate Information Session", slug: "demo-debate-information", description: "See sample events and learn how practices work.", event_type: "info_session", starts_at: daysFromNowInChicago(10, 15, 30), ends_at: daysFromNowInChicago(10, 16, 30), location: "Room 306", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.jazzInterest, school_id: schoolId("south"), club_id: DEMO_IDS.clubs.jazz, created_by: userId(users, "omar"), title: "Jazz Ensemble Interest Meeting", slug: "demo-jazz-interest", description: "Meet the ensemble and learn about the fall rehearsal plan.", event_type: "info_session", starts_at: daysFromNowInChicago(14, 15, 30), ends_at: daysFromNowInChicago(14, 16, 30), location: "Music Room", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.highCoding, school_id: schoolId("high"), club_id: DEMO_IDS.clubs.highCoding, created_by: userId(users, "cameron"), title: "Coding Project Jam", slug: "demo-high-coding-jam", description: "Form teams and build a small web project.", event_type: "workshop", starts_at: daysFromNowInChicago(6, 15, 30), ends_at: daysFromNowInChicago(6, 17), location: "Lab 2", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.highQuiz, school_id: schoolId("high"), club_id: DEMO_IDS.clubs.highQuiz, created_by: userId(users, "jamie"), title: "Quiz Bowl Practice", slug: "demo-high-quiz-practice", description: "First full-team practice of the semester.", event_type: "practice", starts_at: daysFromNowInChicago(11, 15, 30), ends_at: daysFromNowInChicago(11, 16, 30), location: "Room 104", visibility: "members", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.northScience, school_id: schoolId("north"), club_id: DEMO_IDS.clubs.northScience, created_by: userId(users, "rowan"), title: "Science Olympiad Team Launch", slug: "demo-north-science-launch", description: "Meet teammates and select events.", event_type: "meeting", starts_at: daysFromNowInChicago(8, 15, 30), ends_at: daysFromNowInChicago(8, 16, 45), location: "Science Lab", visibility: "public", status: "approved", importance: "normal", send_email_to_members: false },
    { id: DEMO_IDS.events.northKey, school_id: schoolId("north"), club_id: DEMO_IDS.clubs.northKey, created_by: userId(users, "skyler"), title: "Key Club Service Planning", slug: "demo-north-key-planning", description: "Select the first fall service project.", event_type: "meeting", starts_at: daysFromNowInChicago(12, 15, 30), ends_at: daysFromNowInChicago(12, 16, 30), location: "Room 132", visibility: "members", status: "approved", importance: "normal", send_email_to_members: false },
  ];
  await upsertRows(admin, "events", eventRows);
  await upsertRows(admin, "event_rsvps", [
    [DEMO_IDS.events.roboticsLab, "maya", "going"],
    [DEMO_IDS.events.roboticsLab, "jordan", "going"],
    [DEMO_IDS.events.activitiesFair, "jordan", "interested"],
    [DEMO_IDS.events.serviceKickoff, "maya", "going"],
    [DEMO_IDS.events.debateInfo, "casey", "going"],
    [DEMO_IDS.events.highCoding, "devon", "going"],
    [DEMO_IDS.events.northScience, "emery", "going"],
  ].map(([event, account, status], index) => ({
    id: demoUuid(3000 + index), event_id: event, user_id: userId(users, account), status,
  })), "event_id,user_id");

  const opportunities = [
    { id: DEMO_IDS.opportunities.fairCrew, title: "Fall Activities Fair Volunteer Crew", slug: "demo-fall-fair-volunteer-crew", summary: "Welcome attendees and help club leaders find their tables.", description: "Students can volunteer for setup, welcome, or cleanup shifts at the fictional demonstration activities fair.", category: "Leadership", deadline: daysFromNowInChicago(3, 18), event_date: daysFromNowInChicago(5, 15, 30), location: "Commons", action_label: "Sign Up" },
    { id: DEMO_IDS.opportunities.stemMentor, title: "Youth STEM Mentor Interest Form", slug: "demo-youth-stem-mentor", summary: "Share beginner engineering activities with younger learners.", description: "Submit interest in a fictional, supervised STEM mentoring team.", category: "STEM", deadline: daysFromNowInChicago(12, 17), event_date: daysFromNowInChicago(20, 16), location: "Innovation Lab", action_label: "Register Interest" },
    { id: DEMO_IDS.opportunities.cleanup, title: "Community Cleanup Day", slug: "demo-community-cleanup-day", summary: "Join a supervised outdoor cleanup team.", description: "Students choose a two-hour service shift and receive preparation details in StormHub.", category: "Service", deadline: daysFromNowInChicago(9, 17), event_date: daysFromNowInChicago(14, 9), location: "Demo Community Park", action_label: "RSVP" },
    { id: DEMO_IDS.opportunities.photography, title: "Student Photography Team", slug: "demo-student-photography-team", summary: "Help document fictional school activities for the demo gallery.", description: "Students interested in event photography can register for an orientation.", category: "Arts", deadline: daysFromNowInChicago(16, 17), event_date: daysFromNowInChicago(24, 15, 30), location: "Media Center", action_label: "Sign Up" },
    { id: DEMO_IDS.opportunities.tutoring, title: "Peer Tutoring Interest Form", slug: "demo-peer-tutoring-interest", summary: "Share a subject strength through supervised peer support.", description: "Register interest in the fictional peer tutoring program and select comfortable subject areas.", category: "Academic", deadline: daysFromNowInChicago(18, 17), event_date: null, location: "Library", action_label: "Register Interest" },
    { id: DEMO_IDS.opportunities.expired, title: "Expired Summer Welcome Crew", slug: "demo-expired-summer-welcome", summary: "A completed example that must not appear in active lists.", description: "This fictional opportunity is intentionally expired for lifecycle verification.", category: "Leadership", deadline: daysFromNowInChicago(-10, 17), event_date: daysFromNowInChicago(-7, 9), location: "Commons", action_label: "Sign Up" },
  ].map((opportunity) => ({
    ...opportunity,
    school_id: schoolId("south"),
    club_id: null,
    author_id: userId(users, "alex"),
    tags: [opportunity.category.toLowerCase(), "fictional-demo"],
    eligibility: "All students in grades 9–12",
    eligible_grades: [9, 10, 11, 12],
    grade_min: 9,
    grade_max: 12,
    external_url: null,
    status: "approved",
    visibility: "public",
    importance: "normal",
    send_email_to_members: false,
    deadline_reminder_enabled: true,
  }));
  await upsertRows(admin, "opportunities", opportunities);

  const demoUserIds = [...users.values()];
  await deleteByIds(admin, "opportunity_signups", "user_id", demoUserIds);
  await deleteByIds(admin, "bookmarks", "user_id", demoUserIds);
  await upsertRows(admin, "opportunity_signups", [
    { id: demoUuid(4000), opportunity_id: DEMO_IDS.opportunities.fairCrew, user_id: userId(users, "maya"), status: "registered" },
    { id: demoUuid(4001), opportunity_id: DEMO_IDS.opportunities.cleanup, user_id: userId(users, "avery"), status: "registered" },
  ], "opportunity_id,user_id");
  const { error: bookmarkError } = await admin.from("bookmarks").insert([
    { id: demoUuid(4010), opportunity_id: DEMO_IDS.opportunities.stemMentor, event_id: null, club_id: null, user_id: userId(users, "maya") },
    { id: demoUuid(4011), opportunity_id: DEMO_IDS.opportunities.photography, event_id: null, club_id: null, user_id: userId(users, "jordan") },
  ]);
  requireNoError(bookmarkError, "Could not seed opportunity bookmarks");

  await upsertRows(admin, "club_assignments", [{
    id: DEMO_IDS.assignment,
    club_id: DEMO_IDS.clubs.robotics,
    author_id: userId(users, "elena"),
    title: "Open Lab Safety Check",
    instructions: "Review the workshop safety guide and describe one safe setup practice before the open lab.",
    due_at: daysFromNowInChicago(6, 20),
    points_possible: 10,
    attachment_url: null,
    submission_mode: "submission",
    status: "published",
    published_at: now,
    scheduled_for: null,
  }]);
  await upsertRows(admin, "club_assignment_submissions", [{
    id: DEMO_IDS.submission,
    assignment_id: DEMO_IDS.assignment,
    student_id: userId(users, "maya"),
    submission_text: "I will keep the work area clear and confirm that batteries are disconnected before changing robot wiring.",
    attachment_url: null,
    status: "returned",
    submitted_at: daysFromNowInChicago(-1, 19),
    grade_points: 10,
    feedback: "Clear, specific safety practice. Thank you for connecting it to the open-lab workflow.",
    graded_by: userId(users, "elena"),
    graded_at: now,
  }], "assignment_id,student_id");
  await upsertRows(admin, "club_resources", [{
    id: DEMO_IDS.resource,
    club_id: DEMO_IDS.clubs.robotics,
    author_id: userId(users, "elena"),
    title: "Robotics Workspace Safety Guide",
    description: "A short in-app reference for safe tool and battery handling.",
    resource_type: "text",
    url: null,
    content: "Wear eye protection at build stations, keep walkways clear, and disconnect batteries before wiring changes.",
    visibility: "members",
    status: "approved",
  }]);

  await deleteByIds(admin, "notifications", "recipient_user_id", demoUserIds);
  const notificationRows = [
    ["maya", "club_event_created", "Robotics Open Lab is coming up", "You are going to Robotics New-Member Open Lab in Room 214.", `/events/${DEMO_IDS.events.roboticsLab}`, DEMO_IDS.clubs.robotics, null, DEMO_IDS.events.roboticsLab, "important"],
    ["maya", "system_message", "Opportunity registration confirmed", "You are registered for Fall Activities Fair Volunteer Crew.", `/opportunities/demo-fall-fair-volunteer-crew`, null, DEMO_IDS.opportunities.fairCrew, null, "normal"],
    ["maya", "club_announcement", "Build Team Orientation", "A new Engineering & Robotics announcement is available.", `/clubs/demo-engineering-robotics/member`, DEMO_IDS.clubs.robotics, null, null, "normal"],
    ["jordan", "system_message", "Student leadership role assigned", "You are the President of Engineering & Robotics Club.", `/manage/clubs/demo-engineering-robotics`, DEMO_IDS.clubs.robotics, null, null, "important"],
    ["jordan", "club_event_created", "Robotics Open Lab", "Your RSVP is confirmed for the new-member open lab.", `/events/${DEMO_IDS.events.roboticsLab}`, DEMO_IDS.clubs.robotics, null, DEMO_IDS.events.roboticsLab, "normal"],
    ["elena", "system_message", "Advisor workspace ready", "You are the verified Advisor for Engineering & Robotics Club.", `/manage/clubs/demo-engineering-robotics`, DEMO_IDS.clubs.robotics, null, null, "normal"],
    ["alex", "approval_needed", "Photography Club needs review", "A fictional draft club is ready for school approval.", `/manage/clubs/drafts`, DEMO_IDS.clubs.photography, null, null, "important"],
    ["alex", "system_message", "Advisor assignments ready", "Published demo clubs have fictional Advisors assigned.", `/admin/users`, null, null, null, "normal"],
    ["dana", "system_message", "Demo district workspace ready", "Three fictional school workspaces are available for district review.", `/admin/districts/${DEMO_DISTRICT.slug}`, null, null, null, "normal"],
    ["harper", "club_event_created", "Quiz Bowl practice scheduled", "The first full-team practice is on your calendar.", `/events/${DEMO_IDS.events.highQuiz}`, DEMO_IDS.clubs.highQuiz, null, DEMO_IDS.events.highQuiz, "normal"],
    ["emery", "club_event_created", "Science Olympiad launch", "Team launch details are available.", `/events/${DEMO_IDS.events.northScience}`, DEMO_IDS.clubs.northScience, null, DEMO_IDS.events.northScience, "normal"],
  ] as const;
  await upsertRows(admin, "notifications", notificationRows.map((row, index) => ({
    id: demoUuid(5000 + index),
    recipient_user_id: userId(users, row[0]),
    school_id: DEMO_ACCOUNTS.find((account) => account.key === row[0])?.role === "district_admin"
      ? null
      : schoolId(DEMO_ACCOUNTS.find((account) => account.key === row[0])?.school ?? "south"),
    type: row[1], title: row[2], message: row[3], link: row[4], club_id: row[5], opportunity_id: row[6], event_id: row[7], importance: row[8], read_at: null,
    created_at: daysFromNowInChicago(-Math.min(index, 3), 14 + (index % 3)),
  })));

  await deleteByIds(admin, "analytics_events", "school_id", DEMO_SCHOOL_IDS);
  const analyticsTypes = [
    ["club_view", "club", DEMO_IDS.clubs.robotics, "jordan", "south"],
    ["club_view", "club", DEMO_IDS.clubs.robotics, "maya", "south"],
    ["event_rsvp", "event", DEMO_IDS.events.roboticsLab, "maya", "south"],
    ["event_rsvp", "event", DEMO_IDS.events.roboticsLab, "jordan", "south"],
    ["opportunity_signup", "opportunity", DEMO_IDS.opportunities.fairCrew, "maya", "south"],
    ["announcement_view", "announcement", DEMO_IDS.announcements.roboticsPublished, "maya", "south"],
    ["assignment_submission", "assignment", DEMO_IDS.assignment, "maya", "south"],
    ["club_view", "club", DEMO_IDS.clubs.highCoding, "devon", "high"],
    ["event_rsvp", "event", DEMO_IDS.events.highCoding, "devon", "high"],
    ["club_view", "club", DEMO_IDS.clubs.northScience, "emery", "north"],
    ["event_rsvp", "event", DEMO_IDS.events.northScience, "emery", "north"],
  ] as const;
  const analyticsRows = Array.from({ length: 36 }, (_, index) => {
    const event = analyticsTypes[index % analyticsTypes.length];
    return {
      id: demoUuid(6000 + index),
      school_id: schoolId(event[4]),
      user_id: userId(users, event[3]),
      event_type: event[0],
      entity_type: event[1],
      entity_id: event[2],
      metadata: { fictionalDemo: true, description: `${event[0].replaceAll("_", " ")} in the synthetic demo tenant` },
      created_at: daysFromNowInChicago(-(index % 28), 12 + (index % 6)),
    };
  });
  await upsertRows(admin, "analytics_events", analyticsRows);

  await deleteByIds(admin, "admin_audit_log", "school_id", DEMO_SCHOOL_IDS);
  await deleteByIds(admin, "admin_audit_log", "entity_id", DEMO_ENTITY_IDS);
  await upsertRows(admin, "admin_audit_log", [
    { id: demoUuid(7000), school_id: schoolId("south"), actor_user_id: userId(users, "alex"), action: "approved", entity_type: "club", entity_id: DEMO_IDS.clubs.robotics, old_data: { status: "draft" }, new_data: { status: "active", fictionalDemo: true }, occurred_at: daysFromNowInChicago(-30, 14) },
    { id: demoUuid(7001), school_id: schoolId("south"), actor_user_id: userId(users, "alex"), action: "assigned_advisor", entity_type: "club_membership", entity_id: DEMO_IDS.clubs.robotics, old_data: {}, new_data: { role: "sponsor", fictionalDemo: true }, occurred_at: daysFromNowInChicago(-29, 14) },
    { id: demoUuid(7002), school_id: schoolId("south"), actor_user_id: userId(users, "elena"), action: "assigned_student_leadership", entity_type: "club_membership", entity_id: DEMO_IDS.clubs.robotics, old_data: { role: "member" }, new_data: { role: "president", fictionalDemo: true }, occurred_at: daysFromNowInChicago(-21, 14) },
  ]);
  await writeSeedMarker(admin, superAdminIdsBefore, "complete");

  const { error: outboxError } = await admin
    .from("email_outbox")
    .delete()
    .ilike("recipient_email", `%@${DEMO_EMAIL_DOMAIN}`);
  requireNoError(outboxError, "Could not clear demo email outbox rows");

  const superAdminIdsAfter = await getSuperAdminIds(admin);
  if (JSON.stringify(superAdminIdsAfter) !== JSON.stringify(superAdminIdsBefore)) {
    fail("Platform super-administrator IDs changed during demo seeding. Stop and investigate immediately.");
  }

  console.log(`Seeded fictional Elkhorn demo version ${ELKHORN_DEMO_VERSION} in project ${assertElkhornDemoSeedEnvironment().projectRef}.`);
  console.log(`Preserved ${superAdminIdsAfter.length} platform super-administrator accounts unchanged.`);
  console.log("Demo login accounts:");
  for (const account of DEMO_ACCOUNTS) console.log(`- ${account.email} — ${account.fullName} (${account.role})`);
  console.log("All login-capable demo accounts use the value supplied through DEMO_ACCOUNT_PASSWORD; the password is not printed.");
}

async function readSeedSnapshot(admin: AdminClient): Promise<{ ids: string[]; status: string }> {
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("old_data,new_data")
    .eq("id", DEMO_IDS.snapshotAudit)
    .maybeSingle();
  requireNoError(error, "Could not read the demo safety snapshot");
  if (!data) fail("The completed demo safety snapshot is missing; seed the environment first.");
  const oldData = data.old_data as { superAdminIds?: unknown };
  const newData = data.new_data as { status?: unknown };
  const ids = Array.isArray(oldData?.superAdminIds)
    ? oldData.superAdminIds.filter((id): id is string => typeof id === "string").sort()
    : [];
  return { ids, status: String(newData?.status ?? "") };
}

async function verifyAuthScope(
  url: string,
  anonKey: string,
  password: string,
  email: string,
  check: (client: SupabaseClient, userId: string) => Promise<void>
): Promise<void> {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  requireNoError(error, `Could not sign in verification account ${email}`);
  if (!data.user) fail(`No authenticated user returned for ${email}.`);
  await check(client, data.user.id);
  await client.auth.signOut();
}

async function verify(admin: AdminClient, password: string): Promise<void> {
  await assertRequiredSchema(admin);
  const snapshot = await readSeedSnapshot(admin);
  if (snapshot.status !== "complete") fail(`Demo seed marker is ${snapshot.status || "incomplete"}. Rerun the seed.`);
  const currentSuperAdmins = await getSuperAdminIds(admin);
  assertTwoSuperAdmins(currentSuperAdmins);
  if (JSON.stringify(currentSuperAdmins) !== JSON.stringify(snapshot.ids)) {
    fail("The platform super-administrator snapshot no longer matches the current accounts.");
  }

  const { data: district, error: districtError } = await admin
    .from("districts")
    .select("id,slug,name")
    .eq("id", DEMO_IDS.district)
    .single();
  requireNoError(districtError, "Demo district is missing");
  if (!district) fail("Demo district is missing.");
  if (district.slug !== DEMO_DISTRICT.slug) fail("Demo district slug does not match the manifest.");

  const [{ data: schools }, { data: profiles }, { data: clubs }, { data: announcements }, { data: settings }] = await Promise.all([
    admin.from("schools").select("id,district_id").in("id", DEMO_SCHOOL_IDS),
    admin.from("profiles").select("id,email,role,school_id,district_id").ilike("email", `%@${DEMO_EMAIL_DOMAIN}`),
    admin.from("clubs").select("id,status,is_listed,is_active").in("id", DEMO_CLUB_IDS),
    admin.from("club_announcements").select("id,status,published_at").in("id", DEMO_ANNOUNCEMENT_IDS),
    admin.from("school_settings").select("school_id,email_sending_enabled,student_content_requires_staff_approval").in("school_id", DEMO_SCHOOL_IDS),
  ]);
  if (schools?.length !== 3 || schools.some((school) => school.district_id !== DEMO_IDS.district)) fail("Demo school district scope is incomplete.");
  if (profiles?.length !== DEMO_ACCOUNTS.length) fail(`Expected ${DEMO_ACCOUNTS.length} demo profiles; found ${profiles?.length ?? 0}.`);
  if (clubs?.length !== DEMO_CLUB_IDS.length) fail(`Expected ${DEMO_CLUB_IDS.length} demo clubs; found ${clubs?.length ?? 0}.`);
  if (announcements?.length !== DEMO_ANNOUNCEMENT_IDS.length) fail("Demo announcements are incomplete.");
  if (settings?.some((setting) => setting.email_sending_enabled)) fail("Outbound email is enabled for a demo school.");
  const southSettings = settings?.find((setting) => setting.school_id === DEMO_IDS.schools.south);
  if (!southSettings?.student_content_requires_staff_approval) fail("Student staff review is not enabled for the primary demo school.");

  const jordan = profiles?.find((profile) => profile.email === `jordan.lee@${DEMO_EMAIL_DOMAIN}`);
  const maya = profiles?.find((profile) => profile.email === `maya.patel@${DEMO_EMAIL_DOMAIN}`);
  const dana = profiles?.find((profile) => profile.email === `dana.mitchell@${DEMO_EMAIL_DOMAIN}`);
  const alex = profiles?.find((profile) => profile.email === `alex.morgan@${DEMO_EMAIL_DOMAIN}`);
  if (jordan?.role !== "student" || maya?.role !== "student") fail("Student demo roles were changed.");
  if (dana?.role !== "district_admin" || dana.district_id !== DEMO_IDS.district || dana.school_id) fail("Dana's district-only scope is invalid.");
  if (alex?.role !== "admin" || alex.school_id !== DEMO_IDS.schools.south) fail("Alex's school-only scope is invalid.");

  const { data: jordanLeadership } = await admin.from("club_memberships").select("role,status").eq("club_id", DEMO_IDS.clubs.robotics).eq("user_id", jordan?.id).single();
  if (jordanLeadership?.role !== "president" || jordanLeadership.status !== "active") fail("Jordan is not the active Robotics President.");
  const preparedDraft = announcements?.find((announcement) => announcement.id === DEMO_IDS.announcements.roboticsDraft);
  if (preparedDraft?.status !== "draft" || preparedDraft.published_at) fail("The prepared Robotics announcement is not a private draft.");
  const photography = clubs?.find((club) => club.id === DEMO_IDS.clubs.photography);
  if (photography?.status !== "draft" || photography.is_listed || photography.is_active) fail("Photography Club is not waiting for school approval.");

  const { data: opportunities } = await admin.from("opportunities").select("id,deadline,event_date,status").in("id", DEMO_OPPORTUNITY_IDS);
  if (opportunities?.length !== DEMO_OPPORTUNITY_IDS.length) fail("Demo opportunities are incomplete.");
  const expired = opportunities?.find((opportunity) => opportunity.id === DEMO_IDS.opportunities.expired);
  if (!expired?.event_date || new Date(expired.event_date).getTime() >= Date.now()) fail("Expired opportunity is not actually expired.");
  const activeOpportunityIds = (opportunities ?? []).filter((opportunity) => {
    const closesAt = opportunity.event_date ?? opportunity.deadline;
    return opportunity.status === "approved" && (!closesAt || new Date(closesAt).getTime() >= Date.now());
  }).map((opportunity) => opportunity.id);
  if (activeOpportunityIds.includes(DEMO_IDS.opportunities.expired)) fail("Expired opportunity was classified as active.");

  const { count: outboxCount, error: outboxError } = await admin
    .from("email_outbox")
    .select("id", { head: true, count: "exact" })
    .ilike("recipient_email", `%@${DEMO_EMAIL_DOMAIN}`);
  requireNoError(outboxError, "Could not verify outbound email suppression");
  if ((outboxCount ?? 0) !== 0) fail("Demo email rows exist in the outbound queue.");

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  await verifyAuthScope(url, anonKey, password, `dana.mitchell@${DEMO_EMAIL_DOMAIN}`, async (client) => {
    const { data, error } = await client.from("schools").select("id,district_id");
    requireNoError(error, "Dana could not read assigned demo schools");
    const ids = (data ?? []).map((school) => school.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...DEMO_SCHOOL_IDS].sort())) fail("Dana can see schools outside or is missing schools inside the demo district.");
  });
  await verifyAuthScope(url, anonKey, password, `alex.morgan@${DEMO_EMAIL_DOMAIN}`, async (client) => {
    const { data, error } = await client.from("schools").select("id");
    requireNoError(error, "Alex could not read the assigned demo school");
    if (data?.length !== 1 || data[0].id !== DEMO_IDS.schools.south) fail("Alex can see a school outside Elkhorn South — DEMO.");
  });
  await verifyAuthScope(url, anonKey, password, `jordan.lee@${DEMO_EMAIL_DOMAIN}`, async (client, actorId) => {
    const { error: adminError } = await client.rpc("get_admin_statistics", { requested_school_id: DEMO_IDS.schools.south, requested_district_id: DEMO_IDS.district });
    if (!adminError) fail("Jordan unexpectedly accessed school administration statistics.");
    const { error: bypassError } = await client
      .from("club_announcements")
      .update({ status: "approved", published_at: new Date().toISOString() })
      .eq("id", DEMO_IDS.announcements.roboticsDraft)
      .eq("author_id", actorId);
    if (!bypassError) fail("Jordan bypassed mandatory staff approval.");
  });
  await verifyAuthScope(url, anonKey, password, `maya.patel@${DEMO_EMAIL_DOMAIN}`, async (client) => {
    const { data, error } = await client.from("clubs").select("id").eq("id", DEMO_IDS.clubs.photography);
    requireNoError(error, "Maya club-scope verification failed");
    if ((data?.length ?? 0) !== 0) fail("Maya can see the private pending Photography Club.");
  });
  await verifyAuthScope(url, anonKey, password, `elena.carter@${DEMO_EMAIL_DOMAIN}`, async (client) => {
    const { data: memberships, error } = await client.from("club_memberships").select("club_id,role").eq("role", "sponsor");
    requireNoError(error, "Elena Advisor-scope verification failed");
    if (memberships?.length !== 1 || memberships[0].club_id !== DEMO_IDS.clubs.robotics) fail("Elena's Advisor assignment is not limited to Robotics.");
  });

  console.log(`Verified fictional Elkhorn demo version ${ELKHORN_DEMO_VERSION}.`);
  console.log("- Seed snapshot complete; two platform super administrators unchanged.");
  console.log("- District, school, Advisor, student-leader, and student scopes verified through authenticated RLS.");
  console.log("- Mandatory staff approval bypass rejected; expired opportunity inactive; external email queue empty.");
}

async function reset(admin: AdminClient): Promise<void> {
  await assertRequiredSchema(admin);
  const snapshot = await readSeedSnapshot(admin);
  const superAdminsBefore = await getSuperAdminIds(admin);
  assertTwoSuperAdmins(superAdminsBefore);
  if (JSON.stringify(superAdminsBefore) !== JSON.stringify(snapshot.ids)) {
    fail("Refusing reset because the super-administrator snapshot no longer matches.");
  }

  const users = await listAuthUsers(admin);
  const manifestEmails = new Set(DEMO_ACCOUNTS.map((account) => account.email.toLowerCase()));
  const demoAuthUsers = users.filter((user) => (
    user.email
    && manifestEmails.has(user.email.toLowerCase())
    && user.user_metadata?.stormhub_demo_account === true
  ));
  const demoUserIds = demoAuthUsers.map((user) => user.id);

  await deleteByIds(admin, "platform_support_access_log", "actor_user_id", demoUserIds);
  await deleteByIds(admin, "platform_support_sessions", "actor_user_id", demoUserIds);
  await deleteByIds(admin, "club_assignment_student_copies", "assignment_id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "club_submission_attachments", "assignment_id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "club_assignment_attachments", "assignment_id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "coursework_upload_intents", "assignment_id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "club_assignment_submissions", "assignment_id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "club_assignments", "id", [DEMO_IDS.assignment]);
  await deleteByIds(admin, "club_event_attendance", "event_id", DEMO_EVENT_IDS);
  await deleteByIds(admin, "event_rsvps", "event_id", DEMO_EVENT_IDS);
  await deleteByIds(admin, "opportunity_signups", "opportunity_id", DEMO_OPPORTUNITY_IDS);
  await deleteByIds(admin, "bookmarks", "user_id", demoUserIds);
  await deleteByIds(admin, "approval_requests", "content_id", [...DEMO_ANNOUNCEMENT_IDS, ...DEMO_EVENT_IDS, ...DEMO_OPPORTUNITY_IDS]);
  await deleteByIds(admin, "notifications", "recipient_user_id", demoUserIds);
  await deleteByIds(admin, "analytics_events", "school_id", DEMO_SCHOOL_IDS);
  await deleteByIds(admin, "club_announcements", "id", DEMO_ANNOUNCEMENT_IDS);
  await deleteByIds(admin, "club_resources", "id", [DEMO_IDS.resource]);
  await deleteByIds(admin, "events", "id", DEMO_EVENT_IDS);
  await deleteByIds(admin, "opportunities", "id", DEMO_OPPORTUNITY_IDS);
  await deleteByIds(admin, "club_member_bans", "club_id", DEMO_CLUB_IDS);
  await deleteByIds(admin, "club_memberships", "club_id", DEMO_CLUB_IDS);
  await deleteByIds(admin, "clubs", "id", DEMO_CLUB_IDS);
  await deleteByIds(admin, "admin_audit_log", "school_id", DEMO_SCHOOL_IDS);
  await deleteByIds(admin, "admin_audit_log", "entity_id", DEMO_ENTITY_IDS);
  await deleteByIds(admin, "admin_audit_log", "id", [DEMO_IDS.snapshotAudit, demoUuid(7000), demoUuid(7001), demoUuid(7002)]);
  const { error: outboxError } = await admin.from("email_outbox").delete().ilike("recipient_email", `%@${DEMO_EMAIL_DOMAIN}`);
  requireNoError(outboxError, "Could not reset demo email outbox rows");

  for (const user of demoAuthUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    requireNoError(error, `Could not remove demo authentication user ${user.email}`);
  }
  await deleteByIds(admin, "schools", "id", DEMO_SCHOOL_IDS);
  await deleteByIds(admin, "districts", "id", [DEMO_IDS.district]);

  const superAdminsAfter = await getSuperAdminIds(admin);
  if (JSON.stringify(superAdminsAfter) !== JSON.stringify(superAdminsBefore)) {
    fail("Platform super-administrator IDs changed during demo reset.");
  }

  console.log(`Reset only the fictional Elkhorn demo tenant in project ${assertElkhornDemoSeedEnvironment().projectRef}.`);
  console.log(`Preserved ${superAdminsAfter.length} platform super-administrator accounts unchanged.`);
}

async function main(): Promise<void> {
  const command = process.argv[2] as DemoCommand | undefined;
  if (!command || !["seed", "verify", "reset"].includes(command)) {
    fail("Usage: tsx scripts/demo/elkhorn-demo.ts <seed|verify|reset>");
  }
  const { password } = assertElkhornDemoSeedEnvironment();
  const admin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (command === "seed") await seed(admin, password);
  else if (command === "verify") await verify(admin, password);
  else await reset(admin);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Elkhorn demo command failed: ${message}`);
  process.exitCode = 1;
});
