import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformSupportAccess } from "@/components/admin/platform-support-access";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";
import type { PlatformSupportSession } from "@/lib/support-access";

const refresh = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("@/lib/actions", () => ({
  startPlatformSupportSession: vi.fn(),
  endPlatformSupportSession: vi.fn(),
}));

const activeSession: PlatformSupportSession = {
  id: "session-1",
  actor_user_id: "platform-admin-1",
  school_id: "school-1",
  reason: "Investigating an Advisor-reported attachment access issue.",
  started_at: "2026-07-28T12:00:00.000Z",
  expires_at: "2099-07-28T12:30:00.000Z",
  ended_at: null,
};

describe("platform support access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clearly disables support when the database update is unavailable", () => {
    render(
      <PlatformSupportAccess
        schoolId="school-1"
        schoolName="Example High"
        schoolSlug="example-high"
        actorEmail="admin@example.edu"
        initialSession={null}
        supportAvailable={false}
      />
    );

    expect(screen.getByText("Database update required")).toBeVisible();
    expect(screen.getByText("How private-data support works")).toBeVisible();
    expect(screen.getByRole("link", { name: /Open support inbox/i })).toHaveAttribute(
      "href",
      "/admin/feedback?school=example-high"
    );
    expect(screen.queryByRole("button", { name: /Start read-only support/i })).not.toBeInTheDocument();
  });

  it("syncs refreshed server state and links to the exact school workspace", async () => {
    const { rerender } = render(
      <PlatformSupportAccess
        schoolId="school-1"
        schoolName="Example High"
        schoolSlug="example-high"
        actorEmail="admin@example.edu"
        initialSession={null}
        supportAvailable
      />
    );

    expect(screen.getByRole("button", { name: /Start read-only support/i })).toBeVisible();

    rerender(
      <PlatformSupportAccess
        schoolId="school-1"
        schoolName="Example High"
        schoolSlug="example-high"
        actorEmail="admin@example.edu"
        initialSession={activeSession}
        supportAvailable
      />
    );

    await waitFor(() => expect(screen.getByText("Support access is active")).toBeVisible());
    expect(screen.getByRole("link", { name: /Open read-only workspace/i })).toHaveAttribute(
      "href",
      "/admin/schools/example-high/support"
    );
  });

  it("locks an open private page as soon as its session expires", async () => {
    render(
      <PlatformSupportExpiryGuard
        expiresAt={new Date(Date.now() - 1_000).toISOString()}
        returnTo="/admin/schools/example-high/support"
      />
    );

    await waitFor(() => expect(screen.getByText("Support access ended")).toBeVisible());
    expect(replace).toHaveBeenCalledWith("/admin/schools/example-high/support");
    expect(refresh).toHaveBeenCalled();
  });
});
