import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import type { Opportunity } from "@/types/database";

vi.mock("@/components/opportunities/bookmark-button", () => ({
  BookmarkButton: ({ activeLabel, inactiveLabel, isBookmarked }: { activeLabel: string; inactiveLabel: string; isBookmarked?: boolean }) => (
    <button>{isBookmarked ? activeLabel : inactiveLabel}</button>
  ),
}));

const opportunity: Opportunity = {
  id: "opp-1",
  school_id: "school-1",
  club_id: null,
  author_id: null,
  title: "Science Fair",
  slug: "science-fair",
  summary: "Register for the school science fair.",
  description: "Details",
  category: "Competition",
  tags: [],
  eligibility: null,
  grade_min: 9,
  grade_max: 12,
  deadline: "2026-08-01T12:00:00.000Z",
  event_date: "2026-08-15T12:00:00.000Z",
  location: "Commons",
  external_url: null,
  action_label: "Apply",
  status: "approved",
  visibility: "public",
  importance: "normal",
  send_email_to_members: false,
  deadline_reminder_enabled: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("OpportunityCard", () => {
  it("renders category, deadline, action, and saved state", () => {
    render(<OpportunityCard opportunity={opportunity} isLoggedIn isBookmarked={false} />);
    expect(screen.getByRole("link", { name: "Science Fair" })).toHaveAttribute("href", "/opportunities/science-fair");
    expect(screen.getByText("Competition")).toBeInTheDocument();
    expect(screen.getByText(/Deadline:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("shows Done for already-saved opportunities", () => {
    render(<OpportunityCard opportunity={opportunity} isLoggedIn isBookmarked />);
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
