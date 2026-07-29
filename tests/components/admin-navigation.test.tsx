import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "@/components/admin/admin-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/statistics",
}));

describe("AdminNavigation", () => {
  it("renders the full platform menu and identifies the current page", () => {
    render(<AdminNavigation role="super_admin" />);

    expect(screen.getByRole("navigation", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Districts" })).toHaveAttribute("href", "/admin/districts");
    expect(screen.getByRole("link", { name: "Support inbox" })).toHaveAttribute("href", "/admin/feedback");
    expect(screen.getByRole("link", { name: "Statistics" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Deletion requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
  });

  it("keeps school administrators in their permitted menu", () => {
    render(<AdminNavigation role="admin" />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Districts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Support inbox" })).not.toBeInTheDocument();
  });

  it("gives district administrators their district workspace without platform support", () => {
    render(<AdminNavigation role="district_admin" />);

    expect(screen.getByRole("link", { name: "District" })).toHaveAttribute("href", "/admin/districts");
    expect(screen.queryByRole("link", { name: "Support inbox" })).not.toBeInTheDocument();
  });
});
