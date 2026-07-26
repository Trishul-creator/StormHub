import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManagementNavigation } from "@/components/manage/management-navigation";
import { ClubManagementNavigation } from "@/components/manage/club-management-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/manage/clubs/science-bowl/coursework",
}));

describe("ManagementNavigation", () => {
  it("shows school administration tools to admins", () => {
    render(<ManagementNavigation role="admin" canApprove canAdminister />);

    expect(screen.getByRole("navigation", { name: "Management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toHaveAttribute("href", "/manage/opportunities");
    expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/manage/approvals");
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
  });

  it("keeps officer navigation scoped to clubs", () => {
    render(<ManagementNavigation role="student" canApprove={false} canAdminister={false} />);

    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clubs" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Approvals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });
});

describe("ClubManagementNavigation", () => {
  it("marks nested coursework pages active and preserves member access", () => {
    render(
      <ClubManagementNavigation
        clubName="Science Bowl"
        slug="science-bowl"
        canManageCoursework
        canManageRoster
      />
    );

    expect(screen.getByRole("navigation", { name: "Science Bowl management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Coursework" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /member view/i })).toHaveAttribute("href", "/clubs/science-bowl/member");
  });

  it("hides teacher-only areas from club officers", () => {
    render(
      <ClubManagementNavigation
        clubName="Science Bowl"
        slug="science-bowl"
        canManageCoursework={false}
        canManageRoster={false}
      />
    );

    expect(screen.queryByRole("link", { name: "Coursework" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });
});
