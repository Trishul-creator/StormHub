import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleOnboardingForm } from "@/components/auth/google-onboarding-form";
import { completeGoogleOnboarding } from "@/lib/actions";

const replace = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/actions", () => ({
  completeGoogleOnboarding: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

describe("GoogleOnboardingForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    toast.mockReset();
    vi.mocked(completeGoogleOnboarding).mockResolvedValue({
      success: true,
      redirectTo: "/dashboard",
    });
  });

  it("submits the verified Google user school selection", async () => {
    render(
      <GoogleOnboardingForm
        schools={[{ id: "school-1", name: "Storm High" }]}
        email="student@gmail.com"
        suggestedName="Google Student"
        next="/dashboard"
        requiresAccessCode={false}
      />
    );

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Grade"), { target: { value: "10" } });
    fireEvent.submit(screen.getByRole("button", { name: "Continue to StormHub" }).closest("form")!);

    await waitFor(() => expect(completeGoogleOnboarding).toHaveBeenCalledWith({
      schoolId: "school-1",
      fullName: "Google Student",
      gradeLevel: "10",
      accessCode: "",
      next: "/dashboard",
    }));
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });
});
