import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityParticipationButton } from "@/components/opportunities/opportunity-participation-button";
import { cancelOpportunitySignup, registerForOpportunity } from "@/lib/actions";

const refresh = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock("@/lib/actions", () => ({
  registerForOpportunity: vi.fn(),
  cancelOpportunitySignup: vi.fn(),
}));

describe("OpportunityParticipationButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    vi.mocked(registerForOpportunity).mockResolvedValue({ success: true });
    vi.mocked(cancelOpportunitySignup).mockResolvedValue({ success: true });
  });

  it("offers a real RSVP action that becomes a confirmed state", async () => {
    render(
      <OpportunityParticipationButton
        opportunityId="opp-1"
        opportunitySlug="science-night"
        actionLabel="RSVP"
        isLoggedIn
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "RSVP" }));
    await waitFor(() => expect(registerForOpportunity).toHaveBeenCalledWith("opp-1"));
    expect(await screen.findByRole("button", { name: "RSVP confirmed" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "RSVP" })).not.toBeInTheDocument();
  });

  it("shows confirmation rather than another signup button for existing signups", () => {
    render(
      <OpportunityParticipationButton
        opportunityId="opp-1"
        opportunitySlug="science-night"
        actionLabel="Sign Up"
        isLoggedIn
        isSignedUp
        compact
      />
    );

    expect(screen.getByText("Signed up")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("does not allow a new signup after the deadline closes", () => {
    render(
      <OpportunityParticipationButton
        opportunityId="opp-1"
        opportunitySlug="science-night"
        actionLabel="Sign Up"
        isLoggedIn
        isClosed
      />
    );

    expect(screen.getByRole("button", { name: "Closed" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Sign Up" })).not.toBeInTheDocument();
  });
});
