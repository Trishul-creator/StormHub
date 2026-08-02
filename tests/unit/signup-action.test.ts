import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createProfileIfMissing: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: mocks.createProfileIfMissing,
  defaultPathForProfile: vi.fn(),
  getAuthUserId: vi.fn(),
  getCurrentProfile: vi.fn(),
}));

import { supabaseSignUp } from "@/lib/actions";

describe("supabaseSignUp", () => {
  const originalEnvironmentDomains = process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS;
  const originalBlockedDomains = process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS;
  const originalRateLimitSecret = process.env.SIGNUP_RATE_LIMIT_SECRET;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS;
    delete process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS;
    delete process.env.SIGNUP_RATE_LIMIT_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    restoreEnvironment("ALLOWED_SIGNUP_EMAIL_DOMAINS", originalEnvironmentDomains);
    restoreEnvironment("BLOCKED_SIGNUP_EMAIL_DOMAINS", originalBlockedDomains);
    restoreEnvironment("SIGNUP_RATE_LIMIT_SECRET", originalRateLimitSecret);
    restoreEnvironment("SUPABASE_SERVICE_ROLE_KEY", originalServiceRoleKey);
  });

  it("allows an active school when the legacy schema lacks allowed_email_domains", async () => {
    const { admin, signUp } = setupClients({
      signupConfig: {
        data: null,
        error: {
          code: "42703",
          message: "column schools.allowed_email_domains does not exist",
        },
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({ success: true, needsConfirmation: true });
    expect(admin.from).toHaveBeenCalledWith("schools");
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "student@example.edu",
      options: expect.objectContaining({
        data: expect.objectContaining({ school_id: "school-1" }),
      }),
    }));
  });

  it("does not misreport an unexpected school query failure as an inactive school", async () => {
    const { signUp } = setupClients({
      school: {
        data: null,
        error: { code: "08006", message: "connection failure" },
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "We couldn't verify your school right now. Please try again.",
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("accepts any email domain when the school is configured with a wildcard", async () => {
    const { signUp } = setupClients({
      signupConfig: {
        data: { allowed_email_domains: ["*"] },
        error: null,
      },
    });

    const result = await submitSignup("student@any-valid-domain.com");

    expect(result).toEqual({ success: true, needsConfirmation: true });
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "student@any-valid-domain.com",
    }));
  });

  it("rejects an incorrect school access code before creating an auth account", async () => {
    const { signUp } = setupClients({ accessCodeValid: false });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "Enter the correct school access code.",
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects and rolls back a signup if Supabase unexpectedly auto-confirms it", async () => {
    const { deleteUser, signOut } = setupClients({
      signup: {
        data: {
          user: { id: "user-1" },
          session: { access_token: "unexpected-session" },
        },
        error: null,
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "Email verification is temporarily unavailable. Please contact support before trying again.",
    });
    expect(signOut).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("explains an opaque Auth mailer failure instead of returning a generic signup error", async () => {
    setupClients({
      signup: {
        data: { user: null, session: null },
        error: {
          name: "AuthRetryableFetchError",
          message: "{}",
          status: 500,
        },
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "We couldn't send the verification email. Please try again later or contact your school administrator.",
    });
  });

  it("asks users to wait when Supabase rate-limits verification email", async () => {
    setupClients({
      signup: {
        data: { user: null, session: null },
        error: {
          name: "AuthApiError",
          message: "email rate limit exceeded",
          status: 429,
        },
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "Too many verification emails have been requested. Wait a few minutes before trying again.",
    });
  });

  it("treats a retry as successful when the first request already created the profile", async () => {
    const { signUp } = setupClients({
      recentProfile: { id: "user-1" },
      signup: {
        data: { user: null, session: null },
        error: {
          name: "AuthApiError",
          message: "captcha protection: request disallowed (already-seen-response)",
          status: 400,
          code: "captcha_failed",
        },
      },
    });

    const result = await submitSignup();

    expect(result).toEqual({ success: true, needsConfirmation: true });
    expect(signUp).toHaveBeenCalledOnce();
  });

  it("rejects mismatched password confirmation before contacting Auth", async () => {
    const { signUp } = setupClients();

    const result = await submitSignup("Student@Example.edu", "DifferentPassword123");

    expect(result).toEqual({ success: false, error: "Passwords do not match." });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rolls back an account when policy acceptance cannot be stored", async () => {
    const { deleteUser } = setupClients({
      acceptanceError: { code: "42P01", message: "policy_acceptances is missing" },
    });

    const result = await submitSignup();

    expect(result).toEqual({
      success: false,
      error: "Account creation requires the latest privacy database migration. Please contact your administrator.",
    });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });
});

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
};

function setupClients(input: {
  school?: QueryResult;
  signupConfig?: QueryResult;
  accessCodeValid?: boolean;
  recentProfile?: Record<string, unknown> | null;
  acceptanceError?: { code?: string; message: string } | null;
  signup?: {
    data: {
      user: { id: string } | null;
      session: Record<string, unknown> | null;
    };
    error: {
      name?: string;
      message: string;
      status?: number;
      code?: string;
    } | null;
  };
} = {}) {
  const school = input.school ?? {
    data: { id: "school-1", is_active: true, is_public: true },
    error: null,
  };
  const signupConfig = input.signupConfig ?? {
    data: { allowed_email_domains: ["example.edu"] },
    error: null,
  };
  const schoolSelect = vi.fn((columns: string) => {
    const result = columns.includes("allowed_email_domains") ? signupConfig : school;
    return {
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(result),
      })),
    };
  });
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const admin = {
    rpc: vi.fn().mockResolvedValue({
      data: input.accessCodeValid ?? true,
      error: null,
    }),
    from: vi.fn((table: string) => {
      if (table === "schools") return { select: schoolSelect };
      if (table === "policy_acceptances") {
        return { upsert: vi.fn().mockResolvedValue({ error: input.acceptanceError ?? null }) };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: input.recentProfile ?? null,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected admin table: ${table}`);
    }),
    auth: { admin: { deleteUser, updateUserById } },
  };

  const signUp = vi.fn().mockResolvedValue(input.signup ?? {
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const profileEq = vi.fn().mockResolvedValue({ error: null });
  const authClient = {
    auth: { signUp, signOut },
    from: vi.fn((table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected auth table: ${table}`);
      return {
        update: vi.fn(() => ({ eq: profileEq })),
      };
    }),
  };

  mocks.createAdminClient.mockReturnValue(admin);
  mocks.createClient.mockResolvedValue(authClient);
  mocks.createProfileIfMissing.mockResolvedValue(null);

  return { admin, authClient, deleteUser, signOut, signUp };
}

function submitSignup(email = "Student@Example.edu", confirmPassword = "StrongPassword123") {
  return supabaseSignUp(
    email,
    "StrongPassword123",
    confirmPassword,
    "Test Student",
    10,
    "SH-1234-ABCD-5678",
    "school-1",
    {
      website: "",
      loadedAt: Date.now() - 2_000,
      captchaToken: null,
      acceptedPolicies: true,
      ageAssurance: "13_or_older",
    }
  );
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
