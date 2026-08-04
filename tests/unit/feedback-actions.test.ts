import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createEmailOutboxItem: vi.fn(),
  createNotification: vi.fn(),
  createPlatformAdminAttentionNotification: vi.fn(),
  getCurrentProfile: vi.fn(),
  getSchoolById: vi.fn(),
  revalidatePath: vi.fn(),
  checkDurableRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: vi.fn(),
  getAuthUserId: vi.fn(),
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("@/lib/schools", () => ({
  DEFAULT_SCHOOL_ID: "default-school-must-not-be-used",
  SUPPORT_EMAIL: "support@example.test",
  getCurrentSchool: vi.fn(),
  getSchoolById: mocks.getSchoolById,
}));
vi.mock("@/lib/notifications", () => ({
  createAdminAttentionNotification: vi.fn(),
  createApprovalNeededNotifications: vi.fn(),
  createEmailOutboxItem: mocks.createEmailOutboxItem,
  createEventRsvpNotifications: vi.fn(),
  createNotification: mocks.createNotification,
  createNotificationsForClubMembers: vi.fn(),
  createNotificationsForClubSponsors: vi.fn(),
  createOpportunityDeadlineReminders: vi.fn(),
  createPlatformAdminAttentionNotification: mocks.createPlatformAdminAttentionNotification,
}));
vi.mock("@/lib/captcha", () => ({
  verifyCaptchaToken: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/request-rate-limit", () => ({
  checkDurableRateLimit: mocks.checkDurableRateLimit,
  markRateLimitAttemptSuccessful: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => name === "x-forwarded-for" ? "203.0.113.10" : null,
  }),
}));

import { respondToFeedback, submitFeedback } from "@/lib/actions";

describe("support feedback release safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkDurableRateLimit
      .mockResolvedValueOnce({ allowed: true, attemptId: "rate-ip" })
      .mockResolvedValueOnce({ allowed: true, attemptId: "rate-sender" });
    mocks.createEmailOutboxItem.mockResolvedValue("outbox-alert");
  });

  it("rejects anonymous feedback without an explicitly selected school", async () => {
    const { admin, feedbackInsert } = supportClients({ user: null });

    await expect(submitFeedback(validFeedback())).resolves.toEqual({
      success: false,
      error: "Choose your school before contacting support.",
    });
    expect(admin.from).not.toHaveBeenCalledWith("schools");
    expect(feedbackInsert).not.toHaveBeenCalled();
  });

  it("validates and stores an anonymous request only in the selected public school", async () => {
    const { feedbackInsert } = supportClients({
      user: null,
      publicSchoolId: "public-school",
    });

    const result = await submitFeedback(validFeedback({ schoolId: "public-school" }));
    expect(result).toMatchObject({ success: true });
    expect(result.message).toMatch(/support request was saved/i);
    expect(feedbackInsert).toHaveBeenCalledWith(expect.objectContaining({
      school_id: "public-school",
      user_id: null,
    }));
    expect(mocks.createPlatformAdminAttentionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New support request",
        link: "/admin/feedback",
      })
    );
  });

  it("ignores a spoofed school selection for an authenticated school user", async () => {
    const { admin, feedbackInsert } = supportClients({
      user: { id: "user-1", email: "student@example.test" },
    });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "user-1",
      role: "student",
      school_id: "assigned-school",
      email: "student@example.test",
    });

    const result = await submitFeedback(validFeedback({ schoolId: "other-school" }));
    expect(result).toMatchObject({ success: true });
    expect(result.message).toMatch(/support request was saved/i);
    expect(admin.from).not.toHaveBeenCalledWith("schools");
    expect(feedbackInsert).toHaveBeenCalledWith(expect.objectContaining({
      school_id: "assigned-school",
      user_id: "user-1",
    }));
  });

  it("does not resolve feedback when no email outbox row was queued", async () => {
    const rpc = vi.fn();
    const feedback = {
      id: "feedback-1",
      school_id: "school-1",
      user_id: "student-1",
      email: "student@example.test",
      name: "Student",
      profile: null,
    };
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => feedbackLookup(feedback)),
      rpc,
    });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "platform-admin-1",
      role: "super_admin",
      school_id: null,
      account_status: "active",
    });
    mocks.getSchoolById.mockResolvedValue({
      id: "school-1",
      name: "School One",
      slug: "school-one",
    });
    mocks.createEmailOutboxItem.mockResolvedValue(null);

    await expect(respondToFeedback(
      "feedback-1",
      "We fixed the problem.",
      "school-1"
    )).resolves.toEqual({
      success: false,
      error: "The response could not be added to email delivery, so this request was not resolved.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("rejects school administrators before loading a platform support ticket", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ from, rpc: vi.fn() });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "school-admin-1",
      role: "admin",
      school_id: "school-1",
      account_status: "active",
    });

    await expect(respondToFeedback(
      "feedback-1",
      "Attempted school-admin response.",
      "school-1"
    )).resolves.toEqual({
      success: false,
      error: "Platform administrator access required.",
    });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.getSchoolById).not.toHaveBeenCalled();
  });

  it("uses a stable dedupe key and resolves only after an outbox id exists", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const feedback = {
      id: "feedback-1",
      school_id: "school-1",
      user_id: "student-1",
      email: "student@example.test",
      name: "Student",
      profile: null,
    };
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => feedbackLookup(feedback)),
      rpc,
    });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "platform-admin-1",
      role: "super_admin",
      school_id: null,
      account_status: "active",
    });
    mocks.getSchoolById.mockResolvedValue({
      id: "school-1",
      name: "School One",
      slug: "school-one",
    });
    mocks.createEmailOutboxItem.mockResolvedValue("outbox-1");

    await expect(respondToFeedback(
      "feedback-1",
      "We fixed the problem.",
      "school-1"
    )).resolves.toEqual({ success: true });
    expect(mocks.createEmailOutboxItem).toHaveBeenCalledWith(expect.objectContaining({
      type: "feedback_response",
      dedupeKey: expect.stringMatching(/^feedback-response:feedback-1:/),
    }));
    expect(rpc).toHaveBeenCalledWith("review_feedback_status", expect.objectContaining({
      target_feedback_id: "feedback-1",
      next_status: "resolved",
    }));
    expect(mocks.createNotification).toHaveBeenCalled();
  });
});

function validFeedback(overrides: Record<string, unknown> = {}) {
  return {
    name: "Visitor",
    email: "visitor@example.test",
    category: "bug",
    message: "The page is not loading correctly.",
    captchaToken: "captcha-token",
    ...overrides,
  };
}

function supportClients({
  user,
  publicSchoolId = null,
}: {
  user: { id: string; email: string } | null;
  publicSchoolId?: string | null;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  const feedbackInsert = vi.fn().mockResolvedValue({ error: null });
  const schoolQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: publicSchoolId ? { id: publicSchoolId } : null,
      error: null,
    }),
  };
  schoolQuery.eq.mockReturnValue(schoolQuery);
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "schools") {
        return { select: vi.fn(() => schoolQuery) };
      }
      if (table === "feedback") return { insert: feedbackInsert };
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  mocks.createClient.mockResolvedValue({ auth: { getUser } });
  mocks.createAdminClient.mockReturnValue(admin);
  mocks.getCurrentProfile.mockResolvedValue(null);
  return { admin, feedbackInsert };
}

function feedbackLookup(feedback: Record<string, unknown>) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: feedback, error: null }),
  };
  query.eq.mockReturnValue(query);
  return { select: vi.fn(() => query) };
}
