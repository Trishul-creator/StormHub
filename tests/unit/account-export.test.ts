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

function createPaginatedClient(
  results: Record<string, Promise<{ data: unknown[] | null; error: unknown }>>,
) {
  const rangeCalls = new Map<string, Array<[number, number]>>();
  const defaultResult = Promise.resolve({ data: [], error: null });
  const client = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async (from: number, to: number) => {
              rangeCalls.set(table, [...(rangeCalls.get(table) ?? []), [from, to]]);
              const result = await (results[table] ?? defaultResult);
              return {
                ...result,
                data: Array.isArray(result.data) ? result.data.slice(from, to + 1) : result.data,
              };
            }),
          })),
        })),
      })),
    })),
  };

  return { client, rangeCalls };
}

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
    expect(payload.opportunity_signups).toEqual([]);
    expect(payload.assignment_submissions).toEqual([]);
    expect(payload.authored_assignments).toEqual([]);
    expect(payload.submission_attachments).toEqual([]);
    expect(payload.assignment_attachments).toEqual([]);
    expect(payload.student_drive_copies).toEqual([]);
    expect(payload.google_drive_connection).toBeNull();
    expect(payload.account_deletion_requests).toEqual([]);
    expect(payload.policy_acceptances).toEqual([]);
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

    const results: Record<string, Promise<{ data: unknown[] | null; error: unknown }>> = {
      club_memberships: Promise.resolve({
        data: [{ id: "membership-1", user_id: "user-1" }],
        error: null,
      }),
      club_assignment_submissions: Promise.resolve({
        data: null,
        error: { code: "PGRST205", message: "Table is not in the schema cache." },
      }),
      club_submission_attachments: Promise.reject(new Error("Temporary database failure")),
      feedback: Promise.resolve({
        data: [{ id: "feedback-1", user_id: "user-1", message: "Help" }],
        error: null,
      }),
      account_deletion_requests: Promise.resolve({
        data: [{ id: "deletion-1", user_id: "user-1", status: "completed" }],
        error: null,
      }),
      policy_acceptances: Promise.resolve({
        data: [{ id: "acceptance-1", user_id: "user-1", privacy_version: "2026-07-30" }],
        error: null,
      }),
    };
    const { client: supabase } = createPaginatedClient(results);

    createClientMock.mockResolvedValue(supabase);
    createAdminClientMock.mockReturnValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(payload.club_memberships).toEqual([{ id: "membership-1", user_id: "user-1" }]);
    expect(payload.assignment_submissions).toEqual([]);
    expect(payload.submission_attachments).toEqual([]);
    expect(payload.feedback_messages).toEqual([
      expect.objectContaining({ id: "feedback-1", user_id: "user-1" }),
    ]);
    expect(payload.account_deletion_requests).toEqual([
      expect.objectContaining({ id: "deletion-1", status: "completed" }),
    ]);
    expect(payload.policy_acceptances).toEqual([
      expect.objectContaining({ id: "acceptance-1", privacy_version: "2026-07-30" }),
    ]);
    expect(payload.export_warnings).toEqual([
      expect.stringContaining("Assignment submissions"),
      expect.stringContaining("Submission attachments"),
    ]);
  });

  it("paginates every export section instead of silently stopping at the API row cap", async () => {
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

    const membershipRows = Array.from({ length: 1001 }, (_, index) => ({
      id: `membership-${index.toString().padStart(4, "0")}`,
      user_id: "user-1",
    }));
    const { client: supabase, rangeCalls } = createPaginatedClient({
      club_memberships: Promise.resolve({ data: membershipRows, error: null }),
    });
    createClientMock.mockResolvedValue(supabase);
    createAdminClientMock.mockReturnValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.club_memberships).toHaveLength(1001);
    expect(payload.club_memberships.at(-1)?.id).toBe("membership-1000");
    expect(rangeCalls.get("club_memberships")).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
    expect(payload.export_warnings).toEqual([]);
  });
});
