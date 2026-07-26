import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { supabaseResendConfirmation, supabaseSignUp } from "@/lib/actions";

const push = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  supabaseSignUp: vi.fn(),
  supabaseResendConfirmation: vi.fn(),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(supabaseSignUp).mockResolvedValue({ success: true, needsConfirmation: true });
    vi.mocked(supabaseResendConfirmation).mockResolvedValue({ success: true });
    push.mockReset();
    refresh.mockReset();
    toast.mockReset();
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
    fireEvent.change(screen.getByLabelText("Grade"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]');
    expect(loadedAt).not.toBeNull();
    fireEvent.change(loadedAt!, { target: { value: String(Date.now() - 2000) } });

    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => {
      expect(supabaseSignUp).toHaveBeenCalledWith(
        "student@example.edu",
        "StrongPassword123",
        "Test Student",
        10,
        "",
        "school-1",
        expect.objectContaining({ captchaToken: null, website: "", loadedAt: expect.any(Number) })
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

  it("only asks for a school signup code when the deployment requires one", () => {
    const schools = [{ id: "school-1", name: "Storm High", slug: "storm-high" }];
    const { rerender } = render(<SignUpForm schools={schools} />);

    expect(screen.queryByLabelText("School signup code")).not.toBeInTheDocument();

    rerender(<SignUpForm schools={schools} requiresAccessCode />);
    expect(screen.getByLabelText("School signup code")).toBeRequired();
  });

  it("can resend the confirmation email from the pending-verification state", async () => {
    render(<SignUpForm schools={[{ id: "school-1", name: "Storm High", slug: "storm-high" }]} />);

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Student" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Student@Example.edu" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPassword123" } });
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
});
