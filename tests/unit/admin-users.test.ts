import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
}));

import { getAdminUsers, normalizeAdminUserSearch } from "@/lib/data";

function inventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "user-1",
    school_id: "school-1",
    district_id: "district-1",
    full_name: "Ada Student",
    email: "ada@example.edu",
    user_role: "student",
    account_status: "active",
    school_name: "North High",
    district_name: "North District",
    club_assignments: [],
    total_count: 125,
    ...overrides,
  };
}

describe("paginated administrative user inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue({
      id: "platform-admin",
      role: "super_admin",
      account_status: "active",
    });
  });

  it("sanitizes PostgREST-sensitive punctuation before searching", () => {
    expect(normalizeAdminUserSearch("  Ada,(%)*  ")).toBe("Ada");
    expect(normalizeAdminUserSearch("student+pilot@example.edu")).toBe(
      "student+pilot@example.edu"
    );
  });

  it("requests an explicit platform page and preserves the database total", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [inventoryRow()],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getAdminUsers({
      page: 2,
      pageSize: 50,
      search: "Ada,(%)",
    });

    expect(rpc).toHaveBeenCalledWith("get_admin_user_inventory", {
      requested_page: 2,
      requested_page_size: 50,
      search_text: "Ada",
      requested_school_id: null,
      requested_role: null,
    });
    expect(result).toMatchObject({
      total: 125,
      page: 2,
      pageSize: 50,
      totalPages: 3,
    });
    expect(result.users[0]).toMatchObject({
      id: "user-1",
      school_name: "North High",
      district_name: "North District",
    });
  });

  it("probes page one for the real total when an out-of-range page is empty", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ total_count: 125 }],
        error: null,
      });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getAdminUsers({ page: 99, pageSize: 50 });

    expect(rpc).toHaveBeenNthCalledWith(2, "get_admin_user_inventory", {
      requested_page: 1,
      requested_page_size: 1,
      search_text: null,
      requested_school_id: null,
      requested_role: null,
    });
    expect(result.total).toBe(125);
    expect(result.totalPages).toBe(3);
    expect(result.users).toEqual([]);
  });

  it("passes an explicit selected school into district inventory requests", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      id: "district-admin",
      role: "district_admin",
      district_id: "district-1",
      account_status: "active",
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [inventoryRow({ total_count: 1 })],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await getAdminUsers({ schoolId: "school-1", page: 1 });

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_user_inventory",
      expect.objectContaining({ requested_school_id: "school-1" })
    );
  });
});
