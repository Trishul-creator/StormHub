import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  defaultPathForProfile: vi.fn(() => "/dashboard"),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: mocks.defaultPathForProfile,
  getAuthUserId: vi.fn(),
  getCurrentProfile: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { completeGoogleOnboarding } from "@/lib/actions";

describe("completeGoogleOnboarding", () => {
  const originalBlockedDomains = process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS;
  const originalAccessCode = process.env.SIGNUP_ACCESS_CODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS;
    delete process.env.SIGNUP_ACCESS_CODE;
  });

  afterEach(() => {
    restoreEnvironment("BLOCKED_SIGNUP_EMAIL_DOMAINS", originalBlockedDomains);
    restoreEnvironment("SIGNUP_ACCESS_CODE", originalAccessCode);
  });

  it("assigns a verified Google user only after the selected school allows the email", async () => {
    const { update } = setupClients({
      email: "student@gmail.com",
      allowedDomains: ["*"],
    });

    const result = await completeGoogleOnboarding({
      schoolId: "school-1",
      fullName: "Google Student",
      gradeLevel: "10",
      next: "/opportunities",
    });

    expect(result).toEqual({ success: true, redirectTo: "/opportunities" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      school_id: "school-1",
      email: "student@gmail.com",
      full_name: "Google Student",
      grade_level: 10,
      role: "student",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not assign a Google user to a school with a non-matching domain", async () => {
    const { update } = setupClients({
      email: "student@gmail.com",
      allowedDomains: ["school.edu"],
    });

    const result = await completeGoogleOnboarding({
      schoolId: "school-1",
      fullName: "Google Student",
      gradeLevel: "",
      next: "/dashboard",
    });

    expect(result).toEqual({
      success: false,
      error: "Please use an approved school email address (school.edu).",
    });
    expect(update).not.toHaveBeenCalled();
  });
});

function setupClients({
  email,
  allowedDomains,
}: {
  email: string;
  allowedDomains: string[];
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: "google-user",
        email,
        app_metadata: { provider: "google", providers: ["google"] },
      },
    },
    error: null,
  });
  mocks.createClient.mockResolvedValue({ auth: { getUser } });

  const update = vi.fn();
  const completedProfile = {
    id: "google-user",
    email,
    full_name: "Google Student",
    school_id: "school-1",
    grade_level: 10,
    role: "student",
    account_status: "active",
  };
  const profiles = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "google-user",
            email,
            role: "student",
            school_id: null,
            account_status: "active",
          },
          error: null,
        }),
      })),
    })),
    update: update.mockImplementation(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: completedProfile, error: null }),
          })),
        })),
      })),
    })),
  };
  const schools = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "school-1",
            is_active: true,
            is_public: true,
            allowed_email_domains: allowedDomains,
          },
          error: null,
        }),
      })),
    })),
  };
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "profiles") return profiles;
      if (table === "schools") return schools;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });

  return { update };
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
