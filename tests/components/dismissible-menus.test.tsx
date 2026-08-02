import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DismissibleDetails } from "@/components/ui/dismissible-details";
import { NotificationBell } from "@/components/notifications/notification-bell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

describe("dismissible menus", () => {
  it("closes a temporary details panel when clicking outside", () => {
    render(
      <div>
        <DismissibleDetails>
          <summary>Create district</summary>
          <div>Create district workspace</div>
        </DismissibleDetails>
        <button type="button">Outside</button>
      </div>
    );

    fireEvent.click(screen.getByText("Create district"));
    expect(screen.getByText("Create district").closest("details")).toHaveAttribute("open");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByText("Create district").closest("details")).not.toHaveAttribute("open");
  });

  it("closes a temporary details panel with Escape", () => {
    render(
      <DismissibleDetails>
        <summary>Create school</summary>
        <div>Create school workspace</div>
      </DismissibleDetails>
    );

    fireEvent.click(screen.getByText("Create school"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("Create school").closest("details")).not.toHaveAttribute("open");
  });

  it("closes notifications when clicking anywhere outside the menu", () => {
    render(
      <div>
        <NotificationBell notifications={[]} unreadCount={0} />
        <button type="button">Outside</button>
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText(/No notifications yet/i)).toBeVisible();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText(/No notifications yet/i)).not.toBeInTheDocument();
  });
});
