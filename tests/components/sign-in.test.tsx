import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/auth/sign-in/page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  demoSignIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mocks.toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  demoSignIn: (...args: unknown[]) => mocks.demoSignIn(...args),
}));

vi.mock("@/components/auth/captcha", () => ({
  Captcha: () => null,
}));

describe("sign-in feedback", () => {
  const originalCaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
    window.history.replaceState({}, "", "/auth/sign-in");
  });

  afterEach(() => {
    if (originalCaptchaSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY = originalCaptchaSiteKey;
    }
  });

  it("shows the specific title and description returned by authentication", async () => {
    mocks.demoSignIn.mockResolvedValue({
      success: false,
      errorTitle: "Incorrect email or password",
      error: "The email or password you entered is incorrect. Try again or reset your password.",
    });

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.demoSignIn).toHaveBeenCalledWith(
      "student@example.edu",
      "WrongPassword123",
      null
    ));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Incorrect email or password",
      description: "The email or password you entered is incorrect. Try again or reset your password.",
      variant: "destructive",
    });
  });

  it("explains that CAPTCHA must be completed before contacting authentication", async () => {
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY = "test-site-key";

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: "CAPTCHA required",
      description: "Complete the CAPTCHA before signing in.",
      variant: "destructive",
    }));
    expect(mocks.demoSignIn).not.toHaveBeenCalled();
  });

  it("rejects an external redirect parameter after a successful password sign-in", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fcollect"
    );
    mocks.demoSignIn.mockResolvedValue({
      success: true,
      redirectTo: "/manage",
    });

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@example.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/manage"));
    expect(mocks.push).not.toHaveBeenCalledWith(expect.stringContaining("evil.example"));
  });

  it("preserves a valid internal redirect after a successful password sign-in", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/sign-in?redirect=%2Fopportunities%2Frobotics"
    );
    mocks.demoSignIn.mockResolvedValue({
      success: true,
      redirectTo: "/dashboard",
    });

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/opportunities/robotics"));
  });
});
