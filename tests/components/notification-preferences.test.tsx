import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferencesForm } from "@/components/notifications/preferences-form";
import { updateNotificationPreferences } from "@/lib/actions";
import type { NotificationPreferences } from "@/types/database";

const toast = vi.fn();

vi.mock("@/lib/actions", () => ({
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

const preferences: NotificationPreferences = {
  user_id: "student-1",
  in_app_enabled: true,
  club_updates_enabled: true,
  opportunity_deadlines_enabled: true,
  important_email_enabled: true,
  urgent_email_enabled: true,
  admin_attention_email_enabled: true,
  weekly_digest_enabled: false,
};

describe("NotificationPreferencesForm", () => {
  beforeEach(() => {
    vi.mocked(updateNotificationPreferences).mockResolvedValue({ success: true });
    toast.mockReset();
  });

  it("allows weekly digest changes and links to the current preview", async () => {
    render(<NotificationPreferencesForm initial={preferences} role="student" />);

    const weeklyDigest = screen.getByRole("checkbox", { name: /weekly digest/i });
    expect(weeklyDigest).toBeEnabled();
    fireEvent.click(weeklyDigest);
    fireEvent.click(screen.getByRole("button", { name: "Save notification preferences" }));

    await waitFor(() => {
      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ weekly_digest_enabled: true })
      );
    });
    expect(screen.getByRole("link", { name: /view weekly digest/i })).toHaveAttribute("href", "/digest");
  });
});
