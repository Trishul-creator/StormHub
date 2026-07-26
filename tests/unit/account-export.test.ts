import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, createClientMock, getAuthContextMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  getAuthContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: getAuthContextMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
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
    expect(payload.export_warnings).toEqual([]);
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

  it("downloads the available data and identifies sections that could not be queried", async () => {
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
      isDemo: false,
    });

    const results: Record<string, Promise<unknown>> = {
      club_memberships: Promise.resolve({
        data: [{ id: "membership-1", user_id: "user-1" }],
        error: null,
      }),
      club_assignment_submissions: Promise.resolve({
        data: null,
        error: { code: "PGRST205", message: "Table is not in the schema cache." },
      }),
      club_submission_attachments: Promise.reject(new Error("Temporary database failure")),
    };
    const defaultResult = Promise.resolve({ data: [], error: null });
    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => results[table] ?? defaultResult),
        })),
      })),
    };

    createClientMock.mockResolvedValue(supabase);
    createAdminClientMock.mockReturnValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(payload.club_memberships).toEqual([{ id: "membership-1", user_id: "user-1" }]);
    expect(payload.assignment_submissions).toEqual([]);
    expect(payload.submission_attachments).toEqual([]);
    expect(payload.export_warnings).toEqual([
      expect.stringContaining("Assignment submissions"),
      expect.stringContaining("Submission attachments"),
    ]);
  });
});
