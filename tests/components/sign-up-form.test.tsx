import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { supabaseSignUp } from "@/lib/actions";

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
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(supabaseSignUp).mockResolvedValue({ success: true, needsConfirmation: true });
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
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    const loadedAt = document.querySelector<HTMLInputElement>('input[name="loadedAt"]');
    expect(loadedAt).not.toBeNull();
    fireEvent.change(loadedAt!, { target: { value: String(Date.now() - 2000) } });

    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => {
      expect(supabaseSignUp).toHaveBeenCalledWith(
        "student@example.edu",
        "password123",
        "Test Student",
        10,
        "",
        "school-1"
      );
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Check your email",
      description: "Confirm your email address to complete signup.",
    });
    expect(push).toHaveBeenCalledWith("/auth/sign-in");
  });
});
