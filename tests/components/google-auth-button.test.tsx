import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

const signInWithOAuth = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({ error: null });
    toast.mockReset();
    window.history.replaceState({}, "", "/auth/sign-in?redirect=%2Fopportunities");
  });

  it("requests identity scopes only and returns through the StormHub callback", async () => {
    render(<GoogleAuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback?next=%2Fopportunities",
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    }));
    expect(JSON.stringify(signInWithOAuth.mock.calls[0])).not.toContain("drive.file");
  });
});
