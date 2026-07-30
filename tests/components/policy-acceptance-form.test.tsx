import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyAcceptanceForm } from "@/components/auth/policy-acceptance-form";
import { acceptCurrentPolicies } from "@/lib/actions";

const replace = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/actions", () => ({
  acceptCurrentPolicies: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

describe("PolicyAcceptanceForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    toast.mockReset();
    vi.mocked(acceptCurrentPolicies).mockResolvedValue({
      success: true,
      redirectTo: "/dashboard",
    });
  });

  it("records the current policies and 13+ assurance before continuing", async () => {
    render(<PolicyAcceptanceForm next="/dashboard" />);

    fireEvent.click(screen.getByRole("checkbox", { name: /at least 13/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /agree to the/i }));
    fireEvent.submit(screen.getByRole("button", { name: "Accept and continue" }).closest("form")!);

    await waitFor(() => {
      expect(acceptCurrentPolicies).toHaveBeenCalledWith({
        acceptedPolicies: true,
        ageAssurance: "13_or_older",
        next: "/dashboard",
      });
    });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });
});
