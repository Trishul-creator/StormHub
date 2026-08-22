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
      />
    );

    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    fireEvent.change(screen.getByLabelText("Grade (students)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("School access code"), { target: { value: "SH-1234-ABCD-5678" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /at least 13/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /agree to the/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Continue to StormHub" }).closest("form")!);

    await waitFor(() => expect(completeGoogleOnboarding).toHaveBeenCalledWith({
      schoolId: "school-1",
      fullName: "Google Student",
      gradeLevel: "10",
      accessCode: "SH-1234-ABCD-5678",
      acceptedPolicies: true,
      ageAssurance: "13_or_older",
      next: "/dashboard",
    }));
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not ask for a code when the school disables access codes", () => {
    render(
      <GoogleOnboardingForm
        schools={[{ id: "school-1", name: "Storm High", requires_access_code: false }]}
        email="student@gmail.com"
        suggestedName="Google Student"
        next="/dashboard"
      />
    );
    fireEvent.change(screen.getByLabelText("School"), { target: { value: "school-1" } });
    expect(screen.queryByLabelText("School access code")).not.toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="accessCode"]')).toHaveValue("");
  });
});
