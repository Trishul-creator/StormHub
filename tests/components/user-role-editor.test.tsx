import { fireEvent, render, screen } from "@testing-library/react";
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
  it("opens a compact menu with only deduplicated published clubs from the teacher's school", async () => {
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

    expect(screen.queryByText("Robotics Club")).not.toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /choose advisor clubs/i }),
      { key: "Enter" }
    );

    expect(await screen.findByText("Robotics Club")).toBeVisible();
    expect(screen.queryByText("Draft Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused Club")).not.toBeInTheDocument();
    expect(screen.queryByText("Unlisted Club")).not.toBeInTheDocument();
  });

  it("renders elevated accounts read-only without an invalid role selector", () => {
    render(
      <UserRoleEditor
        user={{
          ...teacher,
          id: "district-admin",
          role: "district_admin",
          school_id: null,
          district_id: "district-1",
        }}
        actorId="super-admin"
        actorRole="super_admin"
        clubs={[]}
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/manage this elevated assignment/i)).toBeVisible();
  });

  it("offers account controls without role or club editing in aggregate scope", async () => {
    render(
      <UserRoleEditor
        user={{ ...teacher, role: "student" }}
        actorId="super-admin"
        actorRole="super_admin"
        clubs={[]}
        accountActionsOnly
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /account actions/i }),
      { key: "Enter" }
    );
    expect(await screen.findByText("Ban account")).toBeVisible();
    expect(screen.getByText("Delete user")).toBeVisible();
  });
});
