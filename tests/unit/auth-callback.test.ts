import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createProfileIfMissing: vi.fn(),
  defaultPathForProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/auth", () => ({
  createProfileIfMissing: mocks.createProfileIfMissing,
  defaultPathForProfile: mocks.defaultPathForProfile,
}));

import { GET } from "@/app/auth/callback/route";

describe("email verification callback", () => {
  const exchangeCodeForSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { exchangeCodeForSession },
    });
    mocks.createProfileIfMissing.mockResolvedValue({
      id: "user-1",
      role: "student",
      email: "student@example.edu",
    });
    mocks.defaultPathForProfile.mockReturnValue("/dashboard");
  });

  it("exchanges the confirmation code, loads the profile, and starts the session", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "student@example.edu",
          user_metadata: { full_name: "Test Student" },
        },
      },
      error: null,
    });

    const response = await GET(new Request("https://stormhubapp.com/auth/callback?code=confirmation-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("confirmation-code");
    expect(mocks.createProfileIfMissing).toHaveBeenCalledWith(
      "user-1",
      "student@example.edu",
      "Test Student"
    );
    expect(response.headers.get("location")).toBe("https://stormhubapp.com/dashboard");
  });

  it("returns to sign in when the confirmation code cannot be exchanged", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error("expired confirmation code"),
    });

    const response = await GET(new Request("https://stormhubapp.com/auth/callback?code=expired"));

    expect(response.headers.get("location")).toBe("https://stormhubapp.com/auth/sign-in");
    expect(mocks.createProfileIfMissing).not.toHaveBeenCalled();
  });
});
