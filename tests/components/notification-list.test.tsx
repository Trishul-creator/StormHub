import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationList } from "@/components/notifications/notification-list";
import type { Notification } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

describe("NotificationList", () => {
  it("groups notifications and exposes mark all read when unread items exist", () => {
    render(
      <NotificationList
        notifications={[
          notification("1", "approval_needed", null),
          notification("2", "club_event_created", "2026-01-01T00:00:00.000Z"),
          notification("3", "club_announcement", null),
        ]}
      />
    );

    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
    expect(screen.getByText("Approvals")).toBeInTheDocument();
    expect(screen.getByText("Events and RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Club updates")).toBeInTheDocument();
    expect(screen.getAllByText("1 unread")).toHaveLength(2);
  });
});

function notification(id: string, type: Notification["type"], readAt: string | null): Notification {
  return {
    id,
    type,
    read_at: readAt,
    recipient_user_id: "user-1",
    importance: "normal",
    title: `Notification ${id}`,
    message: `Message ${id}`,
    link: null,
    club_id: null,
    opportunity_id: null,
    event_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}
