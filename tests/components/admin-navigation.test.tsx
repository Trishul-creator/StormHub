import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "@/components/admin/admin-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/statistics",
}));

describe("AdminNavigation", () => {
  it("renders the full platform menu and identifies the current page", () => {
    render(<AdminNavigation isSuperAdmin />);

    expect(screen.getByRole("navigation", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Schools" })).toHaveAttribute("href", "/admin/schools");
    expect(screen.getByRole("link", { name: "Support inbox" })).toHaveAttribute("href", "/admin/feedback");
    expect(screen.getByRole("link", { name: "Statistics" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Deletion requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
  });

  it("keeps school administrators in their permitted menu", () => {
    render(<AdminNavigation isSuperAdmin={false} />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Schools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Support inbox" })).not.toBeInTheDocument();
  });
});
