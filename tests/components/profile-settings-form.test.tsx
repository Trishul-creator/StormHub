import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateProfileSettings: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/actions", () => ({
  updateProfileSettings: (...args: unknown[]) => mocks.updateProfileSettings(...args),
}));

describe("ProfileSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers only high-school grade levels or an unset value", () => {
    render(
      <ProfileSettingsForm
        profile={{
          id: "student-1",
          school_id: "school-1",
          full_name: "Pilot Student",
          email: "student@example.edu",
          grade_level: null,
          role: "student",
          account_status: "active",
        }}
      />
    );

    expect(screen.getByRole("option", { name: "Not set" })).toBeInTheDocument();
    for (const grade of [9, 10, 11, 12]) {
      expect(screen.getByRole("option", { name: `${grade}th grade` })).toBeInTheDocument();
    }
    for (const grade of [6, 7, 8]) {
      expect(screen.queryByRole("option", { name: `${grade}th grade` })).not.toBeInTheDocument();
    }
  });
});
