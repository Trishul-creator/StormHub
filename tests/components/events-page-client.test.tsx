import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventsPageClient } from "@/components/events/events-page-client";
import type { Opportunity } from "@/types/database";

const opportunity: Opportunity = {
  id: "opportunity-1",
  school_id: "school-1",
  title: "Science Fair",
  slug: "science-fair",
  summary: "Present a project.",
  event_date: "2026-07-25T12:00:00-05:00",
  deadline: "2026-07-30T12:00:00-05:00",
  location: "Commons",
  status: "approved",
  visibility: "public",
};

describe("EventsPageClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T12:00:00-05:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds opportunity dates and deadlines to the calendar", () => {
    render(
      <EventsPageClient
        events={[]}
        opportunities={[opportunity]}
        isLoggedIn={false}
        rsvpIds={[]}
        userClubIds={[]}
        canParticipate
      />
    );

    const opportunityDate = screen.getByTitle("12:00 PM — Science Fair");
    const opportunityDeadline = screen.getByTitle("12:00 PM — Science Fair deadline");
    expect(opportunityDate).toHaveAttribute("href", "/opportunities/science-fair");
    expect(opportunityDeadline).toHaveAttribute("href", "/opportunities/science-fair");
  });

  it("makes the full day background an accessible selection control", () => {
    render(
      <EventsPageClient
        events={[]}
        opportunities={[opportunity]}
        isLoggedIn={false}
        rsvpIds={[]}
        userClubIds={[]}
        canParticipate
      />
    );

    const day = screen.getByRole("button", { name: "Show events for July 25, 2026" });
    expect(day).toHaveClass("absolute", "inset-0");
    fireEvent.click(day);

    expect(screen.getByRole("heading", { name: "Saturday, July 25" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Science Fair/i })).toHaveLength(4);
  });
});
