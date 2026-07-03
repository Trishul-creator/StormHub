import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isExplicitStagingE2E,
} from "../lib/env";

const requiredPassword = process.env.E2E_TEST_PASSWORD?.trim();

function assertSafeToMutate() {
  if (!isExplicitStagingE2E()) {
    throw new Error("Refusing to set up E2E users unless E2E_ENVIRONMENT=staging.");
  }
  if (process.env.E2E_ALLOW_MUTATIONS !== "true") {
    throw new Error("Refusing to set up E2E users unless E2E_ALLOW_MUTATIONS=true.");
  }
  if (process.env.EMAIL_DELIVERY_MODE !== "outbox_only") {
    throw new Error("Refusing to set up E2E users unless EMAIL_DELIVERY_MODE=outbox_only.");
  }
  if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "disabled") {
    throw new Error("Refusing to set up E2E users when EMAIL_PROVIDER is set to anything other than disabled.");
  }
  if (process.env.AI_FEATURES_ENABLED && !["false", "0"].includes(process.env.AI_FEATURES_ENABLED.toLowerCase())) {
    throw new Error("Refusing to set up E2E users unless AI_FEATURES_ENABLED is false when provided.");
  }
  if (process.env.GROQ_ENABLED && !["false", "0"].includes(process.env.GROQ_ENABLED.toLowerCase())) {
    throw new Error("Refusing to set up E2E users unless GROQ_ENABLED is false when provided.");
  }
  if (!requiredPassword) {
    throw new Error("Missing E2E_TEST_PASSWORD.");
  }
}

type SupabaseAdmin = {
  auth: ReturnType<typeof createClient>["auth"];
  // This script intentionally uses dynamic table names because it runs before
  // generated Supabase database types exist in the app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (relation: string) => any;
};

type E2EUser = {
  email: string;
  fullName: string;
  role: "student" | "teacher" | "admin" | "super_admin";
  schoolSlug: "school1" | "school2" | null;
  gradeLevel?: number | null;
};

const users: E2EUser[] = [
  {
    email: "e2e.superadmin@stormhub.test",
    fullName: "E2E Super Admin",
    role: "super_admin",
    schoolSlug: null,
  },
  {
    email: "e2e.student.school1@stormhub.test",
    fullName: "E2E Student School 1",
    role: "student",
    schoolSlug: "school1",
    gradeLevel: 10,
  },
  {
    email: "e2e.student.school2@stormhub.test",
    fullName: "E2E Student School 2",
    role: "student",
    schoolSlug: "school2",
    gradeLevel: 10,
  },
  {
    email: "e2e.admin.school1@stormhub.test",
    fullName: "E2E Admin School 1",
    role: "admin",
    schoolSlug: "school1",
  },
  {
    email: "e2e.admin.school2@stormhub.test",
    fullName: "E2E Admin School 2",
    role: "admin",
    schoolSlug: "school2",
  },
  {
    email: "e2e.teacher.school1@stormhub.test",
    fullName: "E2E Teacher School 1",
    role: "teacher",
    schoolSlug: "school1",
  },
];

const stagingSchools = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "School 1",
    slug: "school1",
    city: "Staging",
    state: "ST",
    mascot: "Storm",
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "School 2",
    slug: "school2",
    city: "Staging",
    state: "ST",
    mascot: "Lightning",
  },
] as const;

const school1Clubs = [
  {
    name: "Science Bowl",
    slug: "school1-science-bowl",
    short_description: "Team quiz competition for science knowledge and fast collaboration.",
    long_description: "Science Bowl prepares students for fast-paced science competitions through practices and team events.",
    category: "Academic",
    tags: ["science", "competition"],
  },
  {
    name: "Robotics Club",
    slug: "school1-robotics-club",
    short_description: "Build, code, and test robots with a student engineering team.",
    long_description: "Robotics Club gives students hands-on experience designing, programming, and improving robots.",
    category: "STEM",
    tags: ["robotics", "engineering"],
  },
  {
    name: "Math Club",
    slug: "school1-math-club",
    short_description: "Problem-solving practices, contests, and math enrichment.",
    long_description: "Math Club helps students prepare for contests and explore challenging problems with peers.",
    category: "Academic",
    tags: ["math", "competition"],
  },
] as const;

async function assertRequiredTablesExist(admin: SupabaseAdmin) {
  const requiredTables = ["schools", "school_settings", "clubs", "opportunities", "profiles"] as const;

  for (const table of requiredTables) {
    const { error } = await admin.from(table).select("*").limit(1);
    if (error) {
      throw new Error(
        `Staging schema is missing. Apply base schema/migrations to staging first. Missing or inaccessible table: ${table}.`
      );
    }
  }
}

async function upsertStagingData(admin: SupabaseAdmin): Promise<Map<string, string>> {
  const { error: schoolsError } = await admin.from("schools").upsert([...stagingSchools], { onConflict: "slug" });
  if (schoolsError) throw schoolsError;

  const { data: schools, error: refreshedSchoolsError } = await admin
    .from("schools")
    .select("id,slug")
    .in("slug", ["school1", "school2"]);
  if (refreshedSchoolsError) throw refreshedSchoolsError;

  const schoolIds = new Map<string, string>(
    ((schools ?? []) as Array<{ id: string; slug: string }>).map((school) => [school.slug, school.id])
  );
  const school1Id = schoolIds.get("school1");
  const school2Id = schoolIds.get("school2");

  if (!school1Id || !school2Id) {
    throw new Error("Could not create or find staging schools school1 and school2.");
  }

  const schoolSettings = [school1Id, school2Id].map((schoolId) => ({
    school_id: schoolId,
    announcements_enabled: true,
    events_enabled: true,
    resources_enabled: true,
    opportunities_enabled: true,
    volunteering_enabled: false,
    workshops_enabled: false,
    email_sending_enabled: true,
    updated_at: new Date().toISOString(),
  }));
  const { error: settingsError } = await admin
    .from("school_settings")
    .upsert(schoolSettings, { onConflict: "school_id" });
  if (settingsError) throw settingsError;

  const clubRows = school1Clubs.map((club) => ({
    school_id: school1Id,
    name: club.name,
    slug: club.slug,
    short_description: club.short_description,
    long_description: club.long_description,
    category: club.category,
    tags: [...club.tags],
    sponsor_name: null,
    sponsor_email: null,
    meeting_time: null,
    meeting_location: null,
    join_instructions: "Use the interest form to get updates from club leaders.",
    status: "interest_open",
    is_listed: true,
    is_featured: true,
    is_active: true,
    visibility: "public",
    updated_at: new Date().toISOString(),
  }));
  const { error: clubsError } = await admin.from("clubs").upsert(clubRows, { onConflict: "slug" });
  if (clubsError) throw clubsError;

  const { data: clubs, error: refreshedClubsError } = await admin
    .from("clubs")
    .select("id,slug")
    .in(
      "slug",
      school1Clubs.map((club) => club.slug)
    );
  if (refreshedClubsError) throw refreshedClubsError;

  const clubIds = new Map<string, string>(
    ((clubs ?? []) as Array<{ id: string; slug: string }>).map((club) => [club.slug, club.id])
  );
  const requiredClubSlugs = school1Clubs.map((club) => club.slug);
  for (const slug of requiredClubSlugs) {
    if (!clubIds.has(slug)) {
      throw new Error(`Could not create or find staging club ${slug}.`);
    }
  }

  const opportunities = [
    {
      school_id: school1Id,
      club_id: clubIds.get("school1-science-bowl")!,
      title: "Join Science Bowl",
      slug: "school1-science-bowl-interest",
      summary: "Register interest in Science Bowl practices and competition updates.",
      description: "Submit interest so Science Bowl leaders can follow up with practice details.",
      category: "Interest Form",
      tags: ["science", "competition", "club"],
      eligibility: "Open to students at School 1",
      grade_min: 6,
      grade_max: 12,
      deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      action_label: "Sign Up",
      status: "approved",
      visibility: "public",
      updated_at: new Date().toISOString(),
    },
    {
      school_id: school1Id,
      club_id: clubIds.get("school1-robotics-club")!,
      title: "Join Robotics Club",
      slug: "school1-robotics-club-interest",
      summary: "Register interest in Robotics Club build sessions and team updates.",
      description: "Submit interest so Robotics Club leaders can share the next meeting details.",
      category: "Interest Form",
      tags: ["robotics", "engineering", "club"],
      eligibility: "Open to students at School 1",
      grade_min: 6,
      grade_max: 12,
      deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      action_label: "Sign Up",
      status: "approved",
      visibility: "public",
      updated_at: new Date().toISOString(),
    },
    {
      school_id: school1Id,
      club_id: clubIds.get("school1-math-club")!,
      title: "Math Club Contest Interest",
      slug: "school1-math-club-contest-interest",
      summary: "Get updates for Math Club contest prep and competition signups.",
      description: "Submit interest so Math Club leaders can send practice and contest information.",
      category: "Competition",
      tags: ["math", "competition", "club"],
      eligibility: "Open to students at School 1",
      grade_min: 6,
      grade_max: 12,
      deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      action_label: "Sign Up",
      status: "approved",
      visibility: "public",
      updated_at: new Date().toISOString(),
    },
  ];
  const { error: opportunitiesError } = await admin
    .from("opportunities")
    .upsert(opportunities, { onConflict: "slug" });
  if (opportunitiesError) throw opportunitiesError;

  return schoolIds;
}

async function findAuthUserId(admin: { auth: SupabaseAdmin["auth"] }, email: string): Promise<string | null> {
  let page = 1;
  const perPage = 100;

  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }

  throw new Error("Too many auth users to scan safely. Narrow the staging project or create test users manually.");
}

async function assertAuthUserReady(admin: { auth: SupabaseAdmin["auth"] }, userId: string, email: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  const authUser = data.user;
  if (!authUser) throw new Error(`Could not verify auth user ${email}.`);
  if (authUser.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error(`Auth user email mismatch while preparing ${email}.`);
  }
  if (!authUser.email_confirmed_at && !authUser.confirmed_at) {
    throw new Error(`Auth user ${email} is not email-confirmed after setup.`);
  }
}

async function main() {
  assertSafeToMutate();

  const admin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseAdmin;

  await assertRequiredTablesExist(admin);
  const schoolIds = await upsertStagingData(admin);

  for (const user of users) {
    const schoolId = user.schoolSlug ? schoolIds.get(user.schoolSlug)! : null;
    const metadata = {
      full_name: user.fullName,
      school_id: schoolId,
      grade_level: user.gradeLevel ? String(user.gradeLevel) : undefined,
    };

    let userId = await findAuthUserId(admin, user.email);

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: requiredPassword,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw error;
      userId = data.user?.id ?? null;
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: requiredPassword,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw error;
    }

    if (!userId) throw new Error(`Could not create or find ${user.email}.`);
    await assertAuthUserReady(admin, userId, user.email);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      school_id: schoolId,
      grade_level: user.gradeLevel ?? null,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    const { data: profile, error: verifyProfileError } = await admin
      .from("profiles")
      .select("id,email,role,school_id")
      .eq("id", userId)
      .maybeSingle();
    if (verifyProfileError) throw verifyProfileError;
    if (!profile) throw new Error(`Profile was not created for ${user.email}.`);
    if (profile.role !== user.role) throw new Error(`Profile role mismatch for ${user.email}.`);
    if ((profile.school_id ?? null) !== schoolId) throw new Error(`Profile school mismatch for ${user.email}.`);
  }

  console.log(`Staging E2E data and users are ready: ${users.length} accounts.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Staging E2E setup failed.");
  process.exit(1);
});
