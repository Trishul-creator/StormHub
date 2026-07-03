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
  if (!requiredPassword) {
    throw new Error("Missing E2E_TEST_PASSWORD.");
  }
}

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

async function findAuthUserId(admin: { auth: ReturnType<typeof createClient>["auth"] }, email: string): Promise<string | null> {
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

async function main() {
  assertSafeToMutate();

  const admin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: schools, error: schoolsError } = await admin
    .from("schools")
    .select("id,slug")
    .in("slug", ["school1", "school2"]);
  if (schoolsError) throw schoolsError;

  const schoolIds = new Map((schools ?? []).map((school) => [school.slug as string, school.id as string]));
  for (const slug of ["school1", "school2"]) {
    if (!schoolIds.has(slug)) {
      throw new Error(`Missing ${slug}. Run supabase/staging-setup.sql before staging:setup.`);
    }
  }

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
  }

  console.log(`Staging E2E users are ready: ${users.length} accounts.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Staging E2E setup failed.");
  process.exit(1);
});
