import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  revalidatePath: vi.fn(),
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
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { submitContent, updateClubMember, updateProfileSettings } from "@/lib/actions";

describe("profile and content action validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue({
      id: "student-1",
      school_id: "school-1",
      full_name: "Pilot Student",
      email: "student@example.edu",
      role: "student",
      account_status: "active",
    });
  });

  it("rejects a middle-school grade instead of silently clearing it", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ from });

    await expect(updateProfileSettings({
      fullName: "Pilot Student",
      gradeLevel: 8,
    })).resolves.toEqual({
      success: false,
      error: "Grade must be between 9 and 12, or left blank.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([9, 12, null])("accepts the supported grade value %s", async (gradeLevel) => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mocks.createClient.mockResolvedValue({ from });

    await expect(updateProfileSettings({
      fullName: "Pilot Student",
      gradeLevel,
    })).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({
      full_name: "Pilot Student",
      grade_level: gradeLevel,
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///tmp/private",
  ])("rejects an unsafe resource URL scheme: %s", async (resourceUrl) => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ from });

    await expect(submitContent({
      type: "resource",
      clubSlug: "science-bowl",
      title: "Study guide",
      body: "Read this before the meeting.",
      resource_url: resourceUrl,
    })).resolves.toEqual({
      success: false,
      error: "The resource link must start with http:// or https://.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("enforces server-side title and body limits before writing content", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ from });

    await expect(submitContent({
      type: "announcement",
      clubSlug: "science-bowl",
      title: "No",
      body: "Meeting update",
    })).resolves.toEqual({
      success: false,
      error: "Use a announcement title between 3 and 160 characters.",
    });

    await expect(submitContent({
      type: "event",
      clubSlug: "science-bowl",
      title: "Weekly meeting",
      body: "x".repeat(20_001),
    })).resolves.toEqual({
      success: false,
      error: "Use content between 1 and 20,000 characters.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps platform support access read-only for club rosters", async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ from });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "platform-admin-1",
      school_id: null,
      full_name: "Platform Administrator",
      email: "platform@example.edu",
      role: "super_admin",
      account_status: "active",
    });

    await expect(updateClubMember({
      clubId: "club-1",
      userId: "student-1",
      role: "officer",
    })).resolves.toEqual({
      success: false,
      error: "Platform support access is read-only. A school or district administrator must manage club rosters.",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
