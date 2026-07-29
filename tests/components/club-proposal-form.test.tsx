import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { submitClubProposal } from "@/lib/actions";

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
  submitClubProposal: vi.fn(),
}));

describe("ClubProposalForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitClubProposal).mockResolvedValue({
      success: true,
      message: "Draft created.",
    });
  });

  it("creates a custom club in the selected school and returns to its catalog", async () => {
    render(
      <ClubProposalForm
        requiresApproval={false}
        targetSchoolId="school-id-1"
        returnHref="/admin/schools/school1/drafts"
      />
    );

    fireEvent.change(screen.getByLabelText("Club name"), {
      target: { value: "Aviation Club" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Explore aviation and aerospace careers." },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "STEM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create custom club" }));

    await waitFor(() => {
      expect(submitClubProposal).toHaveBeenCalledWith({
        name: "Aviation Club",
        shortDescription: "Explore aviation and aerospace careers.",
        category: "STEM",
        sponsorUserId: "",
        schoolId: "school-id-1",
      });
    });
    expect(push).toHaveBeenCalledWith("/admin/schools/school1/drafts");
    expect(refresh).toHaveBeenCalled();
  });
});
