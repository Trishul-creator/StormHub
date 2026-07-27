import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserRoleEditor } from "@/components/admin/user-role-editor";
import type { AdminUser, Club } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  deleteUserAccount: vi.fn(),
  updateUserAccountStatus: vi.fn(),
  updateUserRoleAndClubs: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: "club-1",
    school_id: "school-a",
    name: "Robotics Club",
    slug: "robotics",
    is_active: true,
    is_featured: false,
    is_listed: true,
    status: "active",
    visibility: "public",
    ...overrides,
  };
}

const teacher: AdminUser = {
  id: "teacher-1",
  school_id: "school-a",
  full_name: "Teacher",
  email: "teacher@school.edu",
  role: "teacher",
  club_assignments: [],
};

describe("UserRoleEditor sponsor choices", () => {
  it("shows only deduplicated published clubs from the teacher's school", () => {
    render(
      <UserRoleEditor
        user={teacher}
        actorId="super-admin"
        actorRole="super_admin"
        clubs={[
          club(),
          club(),
          club({ id: "other-school", school_id: "school-b", slug: "robotics-b" }),
          club({ id: "draft", name: "Draft Club", slug: "draft", status: "draft", is_active: false, is_listed: false }),
          club({ id: "paused", name: "Paused Club", slug: "paused", status: "paused", is_active: false }),
          club({ id: "unlisted", name: "Unlisted Club", slug: "unlisted", is_listed: false }),
        ]}
      />
    );

    expect(screen.getAllByText("Robotics Club")).toHaveLength(1);
    expect(screen.queryByText("Draft Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Unlisted Club")).not.toBeInTheDocument();
  });
});
