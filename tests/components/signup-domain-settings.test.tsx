import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { updateSchoolSignupDomains } from "@/lib/actions";

const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));
vi.mock("@/lib/actions", () => ({
  updateSchoolSignupDomains: vi.fn(),
}));

describe("SignupDomainSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateSchoolSignupDomains).mockResolvedValue({
      success: true,
      domains: ["students.example.edu"],
    });
  });

  it("shows wildcard status and saves a restricted domain list", async () => {
    render(
      <SignupDomainSettings
        schoolId="school-1"
        schoolName="Storm High"
        domains={["*"]}
      />
    );

    expect(screen.getByText(/currently accepts every verified email domain/i)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Accepted email domains"), {
      target: { value: "Students.Example.edu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save email settings" }));

    await waitFor(() => {
      expect(updateSchoolSignupDomains).toHaveBeenCalledWith({
        schoolId: "school-1",
        domains: "Students.Example.edu",
      });
    });
    expect(toast).toHaveBeenCalledWith({
      title: "Signup email settings updated",
      description: "Storm High now accepts students.example.edu.",
    });
    expect(refresh).toHaveBeenCalled();
  });
});
