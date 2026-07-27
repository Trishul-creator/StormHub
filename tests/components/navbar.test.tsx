import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/layout/navbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/statistics",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  demoSignOut: vi.fn(),
  supabaseSignOut: vi.fn(),
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <button>Notifications</button>,
}));

vi.mock("@/components/theme/theme-controls", () => ({
  ThemeToggle: () => <button>Theme</button>,
}));

describe("Navbar", () => {
  it.each(["student", "teacher", "admin", "super_admin"] as const)(
    "always links the StormHub brand to the public home page for %s",
    (role) => {
      render(<Navbar isLoggedIn role={role} />);
      expect(screen.getByRole("link", { name: /stormhub/i })).toHaveAttribute("href", "/");
    }
  );

  it("keeps all public discovery destinations in the signed-out menu", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Opportunities" })).toHaveAttribute("href", "/opportunities");
  });

  it("keeps administrator discovery catalogs in the top menu and adds administration", () => {
    render(<Navbar isLoggedIn role="admin" schoolSlug="elkhorn-south" />);

    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/s/elkhorn-south/clubs");
    expect(screen.getByRole("link", { name: "Opportunities" })).toHaveAttribute("href", "/s/elkhorn-south/opportunities");
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
  });

  it("does not expose school administration to teachers", () => {
    render(<Navbar isLoggedIn role="teacher" schoolSlug="elkhorn-south" />);

    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/s/elkhorn-south/clubs");
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });
});
