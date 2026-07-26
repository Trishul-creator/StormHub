import { describe, expect, it, vi } from "vitest";
import { isDeadlineSoon, opportunityActionLabel, slugify } from "@/lib/utils";
import type { Club, Event, Opportunity } from "@/types/database";

function visibleClub(club: Partial<Club> = {}) {
  return {
    id: "club",
    school_id: "school-a",
    status: "interest_open",
    is_listed: true,
    visibility: "public",
    ...club,
  } as Club;
}

function visibleOpportunity(opportunity: Partial<Opportunity> = {}) {
  return {
    id: "opp",
    school_id: "school-a",
    status: "approved",
    visibility: "public",
    ...opportunity,
  } as Opportunity;
}

function isPublicClubForSchool(club: Club, schoolId: string) {
  return ["interest_open", "active"].includes(club.status) &&
    club.is_listed &&
    club.visibility === "public" &&
    club.school_id === schoolId;
}

function isPublicOpportunityForSchool(opportunity: Opportunity, schoolId: string) {
  return opportunity.status === "approved" &&
    opportunity.visibility === "public" &&
    opportunity.school_id === schoolId;
}

function upcomingEvents(events: Event[], now: Date) {
  return events.filter((event) => new Date(event.starts_at) >= now);
}

describe("utility helpers", () => {
  it("generates stable URL slugs", () => {
    expect(slugify("Science Bowl! 2026")).toBe("science-bowl-2026");
    expect(slugify("  Robotics & Engineering  ")).toBe("robotics-engineering");
  });

  it("normalizes opportunity action labels", () => {
    expect(opportunityActionLabel(null)).toBe("Sign Up");
    expect(opportunityActionLabel("rsvp")).toBe("RSVP");
    expect(opportunityActionLabel("apply_now")).toBe("Apply Now");
  });

  it("identifies deadlines soon but not past deadlines", () => {
    vi.setSystemTime(new Date("2026-07-02T12:00:00.000Z"));
    expect(isDeadlineSoon("2026-07-05T12:00:00.000Z")).toBe(true);
    expect(isDeadlineSoon("2026-08-05T12:00:00.000Z")).toBe(false);
    expect(isDeadlineSoon("2026-07-01T12:00:00.000Z")).toBe(false);
    vi.useRealTimers();
  });

  it("captures public club visibility rules", () => {
    expect(isPublicClubForSchool(visibleClub(), "school-a")).toBe(true);
    expect(isPublicClubForSchool(visibleClub({ status: "draft" }), "school-a")).toBe(false);
    expect(isPublicClubForSchool(visibleClub({ is_listed: false }), "school-a")).toBe(false);
    expect(isPublicClubForSchool(visibleClub({ visibility: "private" }), "school-a")).toBe(false);
    expect(isPublicClubForSchool(visibleClub(), "school-b")).toBe(false);
  });

  it("captures opportunity visibility and school scoping rules", () => {
    expect(isPublicOpportunityForSchool(visibleOpportunity(), "school-a")).toBe(true);
    expect(isPublicOpportunityForSchool(visibleOpportunity({ status: "pending" }), "school-a")).toBe(false);
    expect(isPublicOpportunityForSchool(visibleOpportunity({ visibility: "private" }), "school-a")).toBe(false);
    expect(isPublicOpportunityForSchool(visibleOpportunity(), "school-b")).toBe(false);
  });

  it("filters upcoming events without including past events", () => {
    const now = new Date("2026-07-02T12:00:00.000Z");
    const events = [
      { id: "past", starts_at: "2026-07-01T12:00:00.000Z" },
      { id: "future", starts_at: "2026-07-03T12:00:00.000Z" },
    ] as Event[];
    expect(upcomingEvents(events, now).map((event) => event.id)).toEqual(["future"]);
  });
});
