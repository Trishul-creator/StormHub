import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManagementNavigation } from "@/components/manage/management-navigation";
import { ClubManagementNavigation } from "@/components/manage/club-management-navigation";

const navigationState = vi.hoisted(() => ({ pathname: "/manage" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

describe("ManagementNavigation", () => {
  it("keeps workflow tools in the contextual management menu", () => {
    navigationState.pathname = "/manage";
    render(<ManagementNavigation role="admin" canApprove />);

    expect(screen.getByRole("navigation", { name: "Management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/manage/approvals");
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clubs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Opportunities" })).not.toBeInTheDocument();
  });

  it("does not render a redundant sub-menu for club officers", () => {
    navigationState.pathname = "/manage";
    render(<ManagementNavigation role="student" canApprove={false} />);

    expect(screen.queryByRole("navigation", { name: "Management" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Approvals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("does not stack the school-management menu inside primary product sections", () => {
    navigationState.pathname = "/manage/clubs";
    const { rerender } = render(<ManagementNavigation role="admin" canApprove />);
    expect(screen.queryByRole("navigation", { name: "Management" })).not.toBeInTheDocument();

    navigationState.pathname = "/manage/opportunities";
    rerender(<ManagementNavigation role="admin" canApprove />);
    expect(screen.queryByRole("navigation", { name: "Management" })).not.toBeInTheDocument();
  });
});

describe("ClubManagementNavigation", () => {
  it("marks nested coursework pages active and preserves member access", () => {
    navigationState.pathname = "/manage/clubs/science-bowl/coursework";
    render(
      <ClubManagementNavigation
        clubName="Science Bowl"
        slug="science-bowl"
        canManageRoster
      />
    );

    expect(screen.getByRole("navigation", { name: "Science Bowl management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Coursework" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Resources" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /member view/i })).toHaveAttribute("href", "/clubs/science-bowl/member");
  });

  it("hides teacher-only areas from club officers", () => {
    navigationState.pathname = "/manage/clubs/science-bowl";
    render(
      <ClubManagementNavigation
        clubName="Science Bowl"
        slug="science-bowl"
        canManageRoster={false}
      />
    );

    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create" })).toBeInTheDocument();
  });
});
