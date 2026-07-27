import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "@/app/auth/forgot-password/page";
import ResetPasswordPage from "@/app/auth/reset-password/page";

const replace = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();
const resetPasswordForEmail = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail,
      getUser,
      onAuthStateChange,
      updateUser,
      signOut,
    },
  }),
}));

describe("password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmail.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("sends a recovery email back through the secure auth callback", async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Student@Example.edu" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "student@example.edu",
      expect.objectContaining({
        redirectTo: expect.stringMatching(/\/auth\/callback\?next=%2Fauth%2Freset-password$/),
      })
    );
    expect(await screen.findByText("student@example.edu")).toBeVisible();
  });

  it("updates a password only after matching confirmation and returns to sign in", async () => {
    render(<ResetPasswordPage />);

    const password = await screen.findByLabelText("New password");
    fireEvent.change(password, { target: { value: "NewStrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewStrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "NewStrongPassword123" }));
    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/auth/sign-in?password_updated=1");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not update a mismatched password", async () => {
    render(<ResetPasswordPage />);

    const password = await screen.findByLabelText("New password");
    fireEvent.change(password, { target: { value: "NewStrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(updateUser).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({
      title: "Password not updated",
      description: "Passwords do not match.",
      variant: "destructive",
    });
  });
});
