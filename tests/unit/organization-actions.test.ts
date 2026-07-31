import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  getDistrictById: vi.fn(),
  getSchoolById: vi.fn(),
  requireRecentAdminAuthentication: vi.fn(),
  revalidatePath: vi.fn(),
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
  defaultPathForProfile: vi.fn(() => "/dashboard"),
  getAuthUserId: vi.fn(),
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("@/lib/districts", () => ({
  getDistrictById: mocks.getDistrictById,
}));
vi.mock("@/lib/schools", () => ({
  getSchoolById: mocks.getSchoolById,
}));
vi.mock("@/lib/admin-step-up", () => ({
  requireRecentAdminAuthentication: mocks.requireRecentAdminAuthentication,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { deleteEmptyDistrict, deleteEmptySchool } from "@/lib/actions";

const platformAdmin = {
  id: "platform-admin-1",
  school_id: null,
  district_id: null,
  full_name: "Platform Administrator",
  email: "platform@example.edu",
  role: "super_admin" as const,
  account_status: "active" as const,
};

describe("organization deletion actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue(platformAdmin);
    mocks.createClient.mockResolvedValue({});
    mocks.requireRecentAdminAuthentication.mockResolvedValue(null);
  });

  it("blocks a populated district without issuing a delete", async () => {
    const deleteDistrict = vi.fn();
    mocks.createAdminClient.mockReturnValue(districtAdminClient({
      schoolCount: 2,
      profileCount: 0,
      deleteDistrict,
    }));

    await expect(deleteEmptyDistrict({
      districtId: "district-1",
      confirmationName: "Example Public Schools",
    })).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("still contains schools"),
    });
    expect(deleteDistrict).not.toHaveBeenCalled();
  });

  it("lets only a recently verified platform admin delete an empty district", async () => {
    const deleteDistrict = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "district-1" },
            error: null,
          }),
        })),
      })),
    }));
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue(districtAdminClient({
      schoolCount: 0,
      profileCount: 0,
      deleteDistrict,
      insertAudit,
    }));

    await expect(deleteEmptyDistrict({
      districtId: "district-1",
      confirmationName: "Example Public Schools",
    })).resolves.toEqual({ success: true });
    expect(mocks.requireRecentAdminAuthentication).toHaveBeenCalled();
    expect(deleteDistrict).toHaveBeenCalledOnce();
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "purge_empty",
      entity_type: "districts",
      entity_id: "district-1",
    }));
  });

  it("keeps school deletion inside the district administrator's scope", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      ...platformAdmin,
      id: "district-admin-1",
      district_id: "district-1",
      role: "district_admin",
    });
    const deleteSchool = vi.fn();
    mocks.createAdminClient.mockReturnValue(schoolAdminClient({
      districtId: "other-district",
      deleteSchool,
    }));

    await expect(deleteEmptySchool({
      schoolId: "school-1",
      confirmationName: "Example High",
    })).resolves.toEqual({
      success: false,
      error: "School not found in your administrative scope.",
    });
    expect(deleteSchool).not.toHaveBeenCalled();
  });
});

function districtAdminClient({
  schoolCount,
  profileCount,
  deleteDistrict = vi.fn(),
  insertAudit = vi.fn().mockResolvedValue({ error: null }),
}: {
  schoolCount: number;
  profileCount: number;
  deleteDistrict?: ReturnType<typeof vi.fn>;
  insertAudit?: ReturnType<typeof vi.fn>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "districts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "district-1",
                  name: "Example Public Schools",
                  slug: "example-public-schools",
                },
                error: null,
              }),
            })),
          })),
          delete: deleteDistrict,
        };
      }
      if (table === "admin_audit_log") return { insert: insertAudit };
      const count = table === "schools" ? schoolCount : profileCount;
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ count, error: null }),
        })),
      };
    }),
  };
}

function schoolAdminClient({
  districtId,
  deleteSchool,
}: {
  districtId: string;
  deleteSchool: ReturnType<typeof vi.fn>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "schools") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "school-1",
                  district_id: districtId,
                  name: "Example High",
                  slug: "example-high",
                },
                error: null,
              }),
            })),
          })),
          delete: deleteSchool,
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        })),
      };
    }),
  };
}
