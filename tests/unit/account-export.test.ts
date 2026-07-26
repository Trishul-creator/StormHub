import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getAuthContextMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getAuthContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: getAuthContextMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "@/app/api/account/export/route";

describe("account export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports an authenticated demo profile without requiring a database client", async () => {
    getAuthContextMock.mockResolvedValue({
      userId: "user-1",
      profile: {
        id: "user-1",
        email: "student@example.com",
        full_name: "Student",
        role: "student",
        school_id: "school-1",
      },
      isLoggedIn: true,
      email: "student@example.com",
      isDemo: true,
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="stormhub-data-/);
    expect(payload.profile.id).toBe("user-1");
    expect(payload.club_memberships).toEqual([]);
    expect(payload.assignment_submissions).toEqual([]);
    expect(payload.authored_assignments).toEqual([]);
    expect(payload.submission_attachments).toEqual([]);
    expect(payload.assignment_attachments).toEqual([]);
    expect(payload.student_drive_copies).toEqual([]);
    expect(payload.google_drive_connection).toBeNull();
    expect(payload).not.toHaveProperty("account_deletion_requests");
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
