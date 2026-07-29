import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  getSchoolById: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: vi.fn(),
  getAuthUserId: vi.fn(),
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock("@/lib/schools", () => ({
  DEFAULT_SCHOOL_ID: "school-1",
  SUPPORT_EMAIL: "support@example.com",
  getCurrentSchool: vi.fn(),
  getSchoolById: mocks.getSchoolById,
}));

import { updateSchoolSignupDomains } from "@/lib/actions";

describe("updateSchoolSignupDomains", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: ["*"], error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    mocks.getSchoolById.mockImplementation(async (id: string) => ({
      id,
      district_id: id === "school-2" ? "district-2" : "district-1",
      name: id,
      slug: id,
      is_active: true,
    }));
  });

  it("lets a school admin update only their own school", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      school_id: "school-1",
      account_status: "active",
    });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-1",
      domains: "*",
    })).resolves.toEqual({ success: true, domains: ["*"] });
    expect(rpc).toHaveBeenCalledWith("set_school_signup_domains", {
      target_school_id: "school-1",
      requested_domains: ["*"],
    });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-2",
      domains: "*",
    })).resolves.toEqual({
      success: false,
      error: "Administrator access required.",
    });
  });

  it("lets a super admin update any school", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      id: "super-1",
      role: "super_admin",
      school_id: null,
      account_status: "active",
    });
    rpc.mockResolvedValue({ data: ["students.example.edu"], error: null });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-2",
      domains: "@Students.Example.edu",
    })).resolves.toEqual({ success: true, domains: ["students.example.edu"] });
  });

  it("lets a district admin update only schools in their district", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      id: "district-admin-1",
      role: "district_admin",
      school_id: null,
      district_id: "district-1",
      account_status: "active",
    });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-1",
      domains: "*",
    })).resolves.toEqual({ success: true, domains: ["*"] });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-2",
      domains: "*",
    })).resolves.toEqual({
      success: false,
      error: "Administrator access required.",
    });
  });

  it("rejects invalid domain settings before calling the database", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      school_id: "school-1",
      account_status: "active",
    });

    await expect(updateSchoolSignupDomains({
      schoolId: "school-1",
      domains: "*, example.edu",
    })).resolves.toEqual({
      success: false,
      error: "Use * by itself to allow every email domain.",
    });
    await expect(updateSchoolSignupDomains({
      schoolId: "school-1",
      domains: "not a domain",
    })).resolves.toEqual({
      success: false,
      error: "Remove invalid domains: not a domain.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
