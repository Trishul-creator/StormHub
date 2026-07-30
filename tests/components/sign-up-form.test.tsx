import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { supabaseResendConfirmation, supabaseSignUp } from "@/lib/actions";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();
const getUser = vi.fn();
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  supabaseSignUp: vi.fn(),
  supabaseResendConfirmation: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser,
      onAuthStateChange,
    },
  }),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(supabaseSignUp).mockClear();
    vi.mocked(supabaseResendConfirmation).mockClear();
    vi.mocked(supabaseSignUp).mockResolvedValue({ success: true, needsConfirmation: true });
    vi.mocked(supabaseResendConfirmation).mockResolvedValue({ success: true });
    push.mockReset();
    replace.mockReset();
    refresh.mockReset();
    toast.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
    unsubscribe.mockReset();
    onAuthStateChange.mockClear();
  });

  it("submits signup to the server action instead of blocking in browser demo mode", async () => {
    render(
      <SignUpForm
        schools={[
          {
            id: "school-1",
            name: "Storm High",
            slug: "storm-high",
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.edu" } });
    fireEvent.change(screen.getByLabelText("Grade (students)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("School access code"), { target: { value: "SH-1234-ABCD-5678" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /at least 13/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /agree to the/i }));
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]');
    expect(loadedAt).not.toBeNull();
    fireEvent.change(loadedAt!, { target: { value: String(Date.now() - 2000) } });

    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => {
      expect(supabaseSignUp).toHaveBeenCalledWith(
        "student@example.edu",
        "StrongPassword123",
        "StrongPassword123",
        "Test Student",
        10,
        "SH-1234-ABCD-5678",
        "school-1",
        expect.objectContaining({
          captchaToken: null,
          website: "",
          loadedAt: expect.any(Number),
          acceptedPolicies: true,
          ageAssurance: "13_or_older",
        })
      );
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Check your email",
      description: "Confirm your email address to complete signup.",
    });
    expect(await screen.findByText("student@example.edu")).toBeVisible();
    expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });

  it("always requires the selected school's access code", () => {
    const schools = [{ id: "school-1", name: "Storm High", slug: "storm-high" }];
    render(<SignUpForm schools={schools} />);
    expect(screen.getByLabelText("School access code")).toBeRequired();
  });

  it("keeps Google signup hidden until production configuration is complete", () => {
    const schools = [{ id: "school-1", name: "Storm High", slug: "storm-high" }];
    const { rerender } = render(<SignUpForm schools={schools} />);

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();

    rerender(<SignUpForm schools={schools} googleAuthEnabled />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  it("requires the confirmation password to match before submitting", async () => {
    render(<SignUpForm schools={[{ id: "school-1", name: "Storm High", slug: "storm-high" }]} />);

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.edu" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "DifferentPassword123" } });
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]')!;
    fireEvent.change(loadedAt, { target: { value: String(Date.now() - 2000) } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: "Sign up failed",
        description: "Passwords do not match.",
        variant: "destructive",
      });
    });
    expect(supabaseSignUp).not.toHaveBeenCalled();
  });

  it("can resend the confirmation email from the pending-verification state", async () => {
    render(<SignUpForm schools={[{ id: "school-1", name: "Storm High", slug: "storm-high" }]} />);

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Student@Example.edu" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("School access code"), { target: { value: "SH-1234-ABCD-5678" } });
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]')!;
    fireEvent.change(loadedAt, { target: { value: String(Date.now() - 2000) } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    fireEvent.click(await screen.findByRole("button", { name: "Resend confirmation email" }));

    await waitFor(() => {
      expect(supabaseResendConfirmation).toHaveBeenCalledWith("student@example.edu", null);
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Confirmation sent",
      description: "Check your inbox for a new verification link.",
    });
  });

  it("automatically continues when the pending email becomes confirmed", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    render(<SignUpForm schools={[{ id: "school-1", name: "Storm High", slug: "storm-high" }]} />);

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.edu" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPassword123" } });
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]')!;
    fireEvent.change(loadedAt, { target: { value: String(Date.now() - 2000) } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });
});
