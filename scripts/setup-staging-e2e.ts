import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isExplicitStagingE2E,
} from "../lib/env";
import {
  ACCEPTABLE_USE_VERSION,
  HIGH_SCHOOL_AGE_ASSURANCE,
  POLICY_ACCEPTANCE_METADATA,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "../lib/policy";

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
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  // This script intentionally uses dynamic table names because it runs before
  // generated Supabase database types exist in the app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (relation: string) => any;
};

type E2EUser = {
  email: string;
  fullName: string;
  role: "student" | "teacher" | "admin" | "district_admin" | "super_admin";
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
    email: "e2e.districtadmin@stormhub.test",
    fullName: "E2E District Admin",
    role: "district_admin",
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
    allowed_email_domains: ["stormhub.test"],
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "School 2",
    slug: "school2",
    city: "Staging",
    state: "ST",
    mascot: "Lightning",
    allowed_email_domains: ["stormhub.test"],
  },
] as const;

const stagingDistrict = {
  id: "d0000000-0000-4000-8000-000000000098",
  name: "Northstar Staging District",
  slug: "northstar-staging-district",
  city: "Staging",
  state: "ST",
  is_active: true,
} as const;

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
  const requiredRelations = [
    {
      table: "districts",
      columns: "id,slug,is_active,access_disabled_at,access_disabled_by_offboarding_request",
    },
    {
      table: "schools",
      columns:
        "id,district_id,address,allowed_email_domains,access_disabled_at,access_disabled_by_offboarding_request",
    },
    { table: "school_settings", columns: "school_id" },
    { table: "clubs", columns: "id" },
    { table: "opportunities", columns: "id,status" },
    { table: "profiles", columns: "id,district_id,account_status,graduation_year" },
    {
      table: "account_deletion_requests",
      columns:
        "id,target_user_id_snapshot,requester_role,scope_type,school_id,district_id,status",
    },
    { table: "admin_audit_log", columns: "id" },
    { table: "digest_deliveries", columns: "id" },
    { table: "request_attempts", columns: "id" },
    { table: "school_signup_access", columns: "school_id,access_code" },
    { table: "platform_support_sessions", columns: "id" },
    { table: "data_retention_runs", columns: "id,status,skipped_reason" },
    {
      table: "legal_holds",
      columns: "id,scope_type,district_id,school_id,category,released_at",
    },
    {
      table: "account_deletion_executions",
      columns: "id,target_user_id,school_id,district_id,status,prepared_at,auth_deleted_at",
    },
    { table: "policy_acceptances", columns: "id,privacy_version,age_assurance" },
    {
      table: "email_outbox",
      columns: "id,attempt_count,next_attempt_at,claim_token,dedupe_key",
    },
    {
      table: "tenant_offboarding_requests",
      columns: "id,scope_type,district_id,school_id,status,tenant_state_before",
    },
    {
      table: "tenant_offboarding_events",
      columns: "id,request_id,event_type,occurred_at",
    },
    {
      table: "tenant_offboarding_profile_snapshots",
      columns: "request_id,profile_id,previous_account_status",
    },
    {
      table: "coursework_upload_intents",
      columns:
        "id,user_id,assignment_id,target,storage_path,expected_size,status,expires_at,attachment_id,object_removed_at",
    },
  ] as const;

  for (const { table, columns } of requiredRelations) {
    const { error } = await admin.from(table).select(columns).limit(1);
    if (error) {
      throw new Error(
        `Staging schema is missing ${table} (${columns}). Apply the migration chain from docs/PRODUCTION_ROLLOUT.md before rerunning E2E. Provider message: ${error.message}`
      );
    }
  }

  const requiredRpcs = [
    {
      name: "list_signup_schools",
      args: { page_offset: 0, page_limit: 1, search_text: null },
    },
    { name: "get_visible_club_member_counts", args: { club_uuids: [] } },
    {
      name: "can_read_school_feedback",
      args: { target_school_id: "00000000-0000-4000-8000-000000000000" },
    },
    {
      name: "can_read_admin_profile",
      args: {
        target_school_id: "00000000-0000-4000-8000-000000000000",
        target_district_id: "00000000-0000-4000-8000-000000000000",
      },
    },
    {
      name: "is_profile_tenant_active",
      args: { target_user_id: "00000000-0000-4000-8000-000000000000" },
    },
    { name: "has_any_active_legal_hold", args: {} },
    {
      name: "can_review_account_deletion_request",
      args: { target_request_id: "00000000-0000-4000-8000-000000000000" },
    },
    {
      name: "finalize_user_account_deletion",
      args: {
        target_execution_id: "00000000-0000-4000-8000-000000000000",
        requested_status: "completed",
        requested_error: null,
      },
    },
    {
      name: "finalize_coursework_attachment_removal",
      args: {
        target_attachment_id: "00000000-0000-4000-8000-000000000000",
        target_assignment_id: "00000000-0000-4000-8000-000000000000",
        target_attachment_kind: "assignment",
        expected_storage_path: null,
      },
    },
  ] as const;
  for (const rpc of requiredRpcs) {
    const { error } = await admin.rpc(rpc.name, rpc.args);
    if (error) {
      throw new Error(
        `Staging schema is missing required RPC ${rpc.name}. Apply every migration through the current branch before rerunning E2E. Provider message: ${error.message}`
      );
    }
  }

  const organizationRpcProbes = [
    {
      name: "update_school_details",
      args: {
        target_school_id: "00000000-0000-4000-8000-000000000000",
        requested_name: "Schema probe",
      },
      expectedError: "School not found",
    },
    {
      name: "update_district_details",
      args: {
        target_district_id: "00000000-0000-4000-8000-000000000000",
        requested_name: "Schema probe",
      },
      expectedError: "District not found",
    },
  ] as const;
  for (const probe of organizationRpcProbes) {
    const { error } = await admin.rpc(probe.name, probe.args);
    if (!error || !error.message.includes(probe.expectedError)) {
      throw new Error(
        `Staging schema is missing the current ${probe.name} organization RPC. Apply every migration through the current branch before rerunning E2E.${error ? ` Provider message: ${error.message}` : ""}`
      );
    }
  }

  const guardedRpcProbes = [
    {
      name: "get_admin_user_inventory",
      args: {
        requested_page: 1,
        requested_page_size: 1,
        search_text: null,
        requested_school_id: null,
        requested_role: null,
      },
      expectedError: "Administrator access required",
    },
    {
      name: "assign_district_administrator",
      args: {
        target_user_id: "00000000-0000-4000-8000-000000000000",
        target_district_id: "00000000-0000-4000-8000-000000000000",
      },
      expectedError: "Platform administrator access required",
    },
    {
      name: "submit_tenant_offboarding_request",
      args: {
        requested_scope_type: "school",
        requested_scope_id: "00000000-0000-4000-8000-000000000000",
        requested_reason: "Staging schema probe only.",
      },
      expectedError: "Active administrator access required",
    },
    {
      name: "review_tenant_offboarding_request",
      args: {
        target_request_id: "00000000-0000-4000-8000-000000000000",
        next_status: "under_review",
      },
      expectedError: "Offboarding request not found",
    },
    {
      name: "cancel_tenant_offboarding_request",
      args: {
        target_request_id: "00000000-0000-4000-8000-000000000000",
        cancellation_reason: "Staging schema probe only.",
      },
      expectedError: "Offboarding request not found",
    },
    {
      name: "create_coursework_upload_intent",
      args: {
        actor_user_uuid: "00000000-0000-4000-8000-000000000000",
        assignment_uuid: "00000000-0000-4000-8000-000000000000",
        upload_target: "submission",
        object_path:
          "00000000-0000-4000-8000-000000000000/submissions/00000000-0000-4000-8000-000000000000/schema-probe",
        expected_file_name: "schema-probe.txt",
        expected_mime_type: "text/plain",
        expected_file_size: 1,
      },
      expectedError: "An active account is required",
    },
    {
      name: "register_coursework_upload_intent",
      args: {
        intent_uuid: "00000000-0000-4000-8000-000000000000",
        actor_user_uuid: "00000000-0000-4000-8000-000000000000",
        assignment_uuid: "00000000-0000-4000-8000-000000000000",
        upload_target: "submission",
        object_path:
          "00000000-0000-4000-8000-000000000000/submissions/00000000-0000-4000-8000-000000000000/schema-probe",
        actual_file_name: "schema-probe.txt",
        actual_mime_type: "text/plain",
        actual_file_size: 1,
      },
      expectedError: "Private upload intent not found",
    },
    {
      name: "prepare_user_account_deletion",
      args: {
        target_user_id: "00000000-0000-4000-8000-000000000000",
      },
      expectedError: "User not found",
    },
    {
      name: "submit_account_deletion_request",
      args: {
        requested_reason: "Staging schema probe only.",
      },
      expectedError: "An active authenticated account is required",
    },
    {
      name: "review_account_deletion_request",
      args: {
        target_request_id: "00000000-0000-4000-8000-000000000000",
        requested_decision: "reject",
        requested_notes: "Staging schema probe only.",
      },
      expectedError: "Account deletion request not found",
    },
    {
      name: "delete_retention_batch",
      args: {
        target_table: "schema_probe",
        target_before: new Date(0).toISOString(),
        target_exclude_id: null,
        target_limit: 1,
      },
      expectedError: "Unsupported retention table",
    },
  ] as const;
  for (const probe of guardedRpcProbes) {
    const { error } = await admin.rpc(probe.name, probe.args);
    if (!error || !error.message.includes(probe.expectedError)) {
      throw new Error(
        `Staging schema is missing the current guarded RPC ${probe.name}. Apply every migration through the current branch before rerunning E2E.${error ? ` Provider message: ${error.message}` : ""}`
      );
    }
  }
}

async function upsertStagingData(admin: SupabaseAdmin): Promise<Map<string, string>> {
  const { error: districtError } = await admin
    .from("districts")
    .upsert(stagingDistrict, { onConflict: "slug" });
  if (districtError) throw districtError;

  const { error: schoolsError } = await admin.from("schools").upsert(
    stagingSchools.map((school) => ({
      ...school,
      district_id: stagingDistrict.id,
    })),
    { onConflict: "slug" },
  );
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
  const { data: accessRows, error: accessError } = await admin
    .from("school_signup_access")
    .select("school_id,access_code")
    .in("school_id", [...schoolIds.values()]);
  if (accessError) throw accessError;
  const accessCodes = new Map<string, string>(
    ((accessRows ?? []) as Array<{ school_id: string; access_code: string }>)
      .map((row) => [row.school_id, row.access_code])
  );

  const stagingUsers = users;
  for (const user of stagingUsers) {
    const schoolId = user.schoolSlug ? schoolIds.get(user.schoolSlug)! : null;
    const authSchoolId = schoolId ?? schoolIds.get("school1")!;
    const schoolAccessCode = accessCodes.get(authSchoolId);
    const metadata = {
      full_name: user.fullName,
      school_id: authSchoolId,
      ...(schoolAccessCode ? { school_access_code: schoolAccessCode } : {}),
      grade_level: user.gradeLevel ? String(user.gradeLevel) : undefined,
      [POLICY_ACCEPTANCE_METADATA.privacy]: PRIVACY_POLICY_VERSION,
      [POLICY_ACCEPTANCE_METADATA.terms]: TERMS_VERSION,
      [POLICY_ACCEPTANCE_METADATA.acceptableUse]: ACCEPTABLE_USE_VERSION,
      [POLICY_ACCEPTANCE_METADATA.ageAssurance]: HIGH_SCHOOL_AGE_ASSURANCE,
    };
    if (!schoolAccessCode) {
      throw new Error(`Staging school access code is missing for ${user.email}.`);
    }

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
    const profilePayload = {
      id: userId,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      school_id: schoolId,
      grade_level: user.gradeLevel ?? null,
      updated_at: new Date().toISOString(),
      ...(user.role === "district_admin"
        ? { district_id: stagingDistrict.id }
        : {}),
    };
    const { error: profileError } = await admin.from("profiles").upsert(profilePayload);
    if (profileError) throw profileError;

    const { error: policyAcceptanceError } = await admin
      .from("policy_acceptances")
      .upsert({
        user_id: userId,
        school_id: schoolId,
        privacy_version: PRIVACY_POLICY_VERSION,
        terms_version: TERMS_VERSION,
        acceptable_use_version: ACCEPTABLE_USE_VERSION,
        age_assurance: HIGH_SCHOOL_AGE_ASSURANCE,
        source: "existing_user",
        accepted_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,privacy_version,terms_version,acceptable_use_version",
      });
    if (policyAcceptanceError) throw policyAcceptanceError;

    const { data: profile, error: verifyProfileError } = await admin
      .from("profiles")
      .select("id,email,role,school_id,district_id")
      .eq("id", userId)
      .maybeSingle();
    if (verifyProfileError) throw verifyProfileError;
    if (!profile) throw new Error(`Profile was not created for ${user.email}.`);
    if (profile.role !== user.role) throw new Error(`Profile role mismatch for ${user.email}.`);
    if ((profile.school_id ?? null) !== schoolId) throw new Error(`Profile school mismatch for ${user.email}.`);
    const expectedDistrictId = user.role === "super_admin" ? null : stagingDistrict.id;
    if ((profile.district_id ?? null) !== expectedDistrictId) {
      throw new Error(`Profile district mismatch for ${user.email}.`);
    }
  }

  console.log(`Staging E2E data and users are ready: ${stagingUsers.length} accounts.`);
}

main().catch((error) => {
  console.error(formatSetupError(error));
  process.exit(1);
});

function formatSetupError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    return ["code", "message", "details", "hint"]
      .map((key) => typeof details[key] === "string" ? `${key}: ${details[key]}` : null)
      .filter(Boolean)
      .join(" | ") || "Staging E2E setup failed with an unknown provider error.";
  }
  return typeof error === "string" ? error : "Staging E2E setup failed.";
}
