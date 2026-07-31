import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserRoleEditor } from "@/components/admin/user-role-editor";
import {
  assignUserToDistrictAdministrator,
  updateUserRoleAndClubs,
} from "@/lib/actions";
import type { AdminUser, Club } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  assignUserToDistrictAdministrator: vi.fn(),
  deleteUserAccount: vi.fn(),
  updateUserAccountStatus: vi.fn(),
  updateUserRoleAndClubs: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

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
        actorEmail="platform@example.edu"
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
        actorEmail="platform@example.edu"
        clubs={[]}
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/elevated account is protected/i)).toBeVisible();
  });

  it("keeps role assignment out of the account-access menu", async () => {
    render(
      <UserRoleEditor
        user={{ ...teacher, role: "student" }}
        actorId="super-admin"
        actorRole="super_admin"
        actorEmail="platform@example.edu"
        clubs={[]}
        districts={[{ id: "district-1", name: "Elkhorn Public Schools" }]}
        accountActionsOnly
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /account actions/i }),
      { key: "Enter" }
    );
    expect(await screen.findByText("Ban account")).toBeVisible();
    expect(screen.queryByText("Assign district admin")).not.toBeInTheDocument();
    expect(screen.getByText("Delete user")).toBeVisible();
  });

  it("assigns district administration from the same polished role control", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(assignUserToDistrictAdministrator).mockResolvedValueOnce({ success: true });

    render(
      <UserRoleEditor
        user={{ ...teacher, role: "student" }}
        actorId="super-admin"
        actorRole="super_admin"
        actorEmail="platform@example.edu"
        clubs={[]}
        districts={[{ id: "district-1", name: "Elkhorn Public Schools" }]}
      />
    );

    const roleControl = screen.getByRole("combobox", { name: /role for teacher/i });
    expect(roleControl).toHaveTextContent("Student");
    fireEvent.keyDown(roleControl, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /district administrator/i }));

    expect(screen.getByRole("combobox", { name: /district for teacher/i })).toHaveTextContent(
      "Elkhorn Public Schools"
    );

    await waitFor(() => {
      expect(assignUserToDistrictAdministrator).toHaveBeenCalledWith({
        targetUserId: "teacher-1",
        districtId: "district-1",
      });
    });
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });

  it("opens identity confirmation immediately and restores the role when it is canceled", async () => {
    vi.mocked(updateUserRoleAndClubs).mockResolvedValueOnce({
      success: false,
      error: "Confirm your identity.",
      reauthRequired: true,
    } as never);
    render(
      <UserRoleEditor
        user={{ ...teacher, role: "student" }}
        actorId="school-admin"
        actorRole="admin"
        actorEmail="admin@school.edu"
        clubs={[]}
      />
    );

    const roleControl = screen.getByRole("combobox", { name: /role for teacher/i });
    fireEvent.keyDown(roleControl, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /teacher.*advisor/i }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByText("Confirm your identity")).toBeVisible();
    expect(screen.getByLabelText(/password for admin@school.edu/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /close identity confirmation/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(roleControl).toHaveTextContent("Student");
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });
});
