import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReauthenticationDialog } from "@/components/auth/admin-reauthentication-dialog";

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

vi.mock("@/components/auth/captcha", () => ({
  Captcha: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("captcha-token")}>
      Complete test CAPTCHA
    </button>
  ),
}));

describe("AdminReauthenticationDialog", () => {
  const originalSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY = "test-site-key";
  });

  afterEach(() => {
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY = originalSiteKey;
    }
  });

  it("passes a CAPTCHA token when confirming an administrative action", async () => {
    const onVerified = vi.fn();
    signInWithPassword.mockResolvedValue({
      data: { user: { email: "owner@example.test" } },
      error: null,
    });

    render(
      <AdminReauthenticationDialog
        open
        onOpenChange={vi.fn()}
        email="owner@example.test"
        onVerified={onVerified}
      />
    );

    fireEvent.change(screen.getByLabelText("Password for owner@example.test"), {
      target: { value: "correct-password" },
    });
    expect(screen.getByRole("button", { name: "Confirm with password" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete test CAPTCHA" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm with password" }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "correct-password",
      options: { captchaToken: "captcha-token" },
    }));
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it("requires a fresh CAPTCHA after an authentication failure", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "captcha_failed", message: "captcha protection: request disallowed" },
    });

    render(
      <AdminReauthenticationDialog
        open
        onOpenChange={vi.fn()}
        email="owner@example.test"
        onVerified={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Password for owner@example.test"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete test CAPTCHA" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm with password" }));

    expect(await screen.findByText(/CAPTCHA could not be verified/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm with password" })).toBeDisabled();
  });
});
