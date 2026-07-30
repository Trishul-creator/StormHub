import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity, School } from "@/types/database";

const mocks = vi.hoisted(() => ({
  deleteOpportunity: vi.fn(),
  setOpportunityStatus: vi.fn(),
  updateOpportunity: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/lib/actions", () => ({
  deleteOpportunity: mocks.deleteOpportunity,
  setOpportunityStatus: mocks.setOpportunityStatus,
  updateOpportunity: mocks.updateOpportunity,
  submitContent: vi.fn(),
}));
vi.mock("@/components/forms/content-form", () => ({
  ContentForm: ({ schoolId }: { schoolId?: string }) => (
    <div data-testid="create-opportunity-form">{schoolId}</div>
  ),
}));

import { OpportunityManagement } from "@/components/manage/opportunity-management";

const school: School = {
  id: "school-1",
  name: "North High School",
  slug: "north-high",
  is_active: true,
  is_public: true,
};

const opportunities: Opportunity[] = [
  {
    id: "published-1",
    school_id: school.id,
    title: "Science Fair",
    slug: "science-fair",
    summary: "Present a project.",
    description: "Present a project.",
    category: "Competition",
    action_label: "Register",
    deadline: "2099-04-01T17:00:00.000Z",
    status: "approved",
    visibility: "public",
  },
  {
    id: "draft-1",
    school_id: school.id,
    title: "College Visit",
    slug: "college-visit",
    summary: "Tour a campus.",
    description: "Tour a campus.",
    category: "College",
    action_label: "Sign Up",
    status: "draft",
    visibility: "public",
  },
];

describe("OpportunityManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setOpportunityStatus.mockResolvedValue({ success: true });
    mocks.deleteOpportunity.mockResolvedValue({ success: true });
    mocks.updateOpportunity.mockResolvedValue({ success: true });
  });

  it("shows the full school inventory and passes an explicit school to creation", () => {
    render(<OpportunityManagement school={school} opportunities={opportunities} />);

    expect(screen.getByText("Science Fair")).toBeInTheDocument();
    expect(screen.getByText("College Visit")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByTestId("create-opportunity-form")).toHaveTextContent("school-1");
    expect(screen.getByRole("link", { name: /preview student view/i })).toHaveAttribute(
      "href",
      "/s/north-high/opportunities"
    );
  });

  it("closes a published listing without deleting its history", async () => {
    render(<OpportunityManagement school={school} opportunities={opportunities} />);

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    await waitFor(() => {
      expect(mocks.setOpportunityStatus).toHaveBeenCalledWith({
        id: "published-1",
        schoolId: "school-1",
        status: "closed",
      });
    });
    expect(mocks.deleteOpportunity).not.toHaveBeenCalled();
  });

  it("offers permanent deletion only for unpublished listings", () => {
    render(<OpportunityManagement school={school} opportunities={opportunities} />);

    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(1);
  });
});
