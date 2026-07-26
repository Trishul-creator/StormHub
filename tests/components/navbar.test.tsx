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
});
