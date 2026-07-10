import { describe, expect, it } from "vitest";
import {
  buildDiscoveryHints,
  buildGlobalSearchResults,
  getNotificationGroupId,
  getRoleOnboardingItems,
  groupNotifications,
} from "@/lib/product";
import type { Club, Event, Notification, Opportunity } from "@/types/database";

describe("product helpers", () => {
  it("builds student onboarding from real activity signals", () => {
    const items = getRoleOnboardingItems("student", {
      joinedClubs: 1,
      savedOpportunities: 0,
      rsvpedEvents: 2,
    });

    expect(items.map((item) => [item.id, item.status])).toEqual([
      ["join-club", "done"],
      ["save-opportunity", "active"],
      ["rsvp-event", "done"],
    ]);
  });

  it("keeps teacher roster steps locked until a club is assigned", () => {
    const items = getRoleOnboardingItems("teacher", {
      manageableClubs: 0,
      pendingApprovals: 0,
    });

    expect(items.find((item) => item.id === "review-approvals")?.status).toBe("done");
    expect(items.find((item) => item.id === "manage-roster")?.status).toBe("locked");
  });

  it("groups notifications by operational category", () => {
    const notifications: Notification[] = [
      notification("1", "approval_needed", null),
      notification("2", "club_event_created", "2026-01-01T00:00:00.000Z"),
      notification("3", "club_announcement", null),
      notification("4", "opportunity_deadline_soon", null),
    ];

    expect(getNotificationGroupId("content_rejected")).toBe("approvals");
    expect(groupNotifications(notifications).map((group) => [group.id, group.unreadCount])).toEqual([
      ["approvals", 1],
      ["events", 0],
      ["club_updates", 1],
      ["opportunities", 1],
    ]);
  });

  it("scores global search results across clubs, events, and opportunities", () => {
    const club = {
      id: "club-1",
      school_id: "school-1",
      name: "Robotics Club",
      slug: "robotics-club",
      short_description: "Build robots",
      category: "Engineering",
      tags: ["robotics"],
      is_featured: true,
      is_listed: true,
      status: "active",
      is_active: true,
      visibility: "public",
    } satisfies Club;
    const event = {
      id: "event-1",
      school_id: "school-1",
      title: "Robotics Build Session",
      description: "Drive practice",
      event_type: "practice",
      starts_at: "2026-01-01T00:00:00.000Z",
      visibility: "public",
      status: "approved",
    } satisfies Event;
    const opportunity = {
      id: "opp-1",
      school_id: "school-1",
      title: "Science Bowl Tryout",
      slug: "science-bowl-tryout",
      summary: "Competition team tryout",
      category: "Science",
      status: "approved",
      visibility: "public",
    } satisfies Opportunity;

    const results = buildGlobalSearchResults({
      query: "robotics",
      clubs: [club],
      events: [event],
      opportunities: [opportunity],
    });

    expect(results.map((result) => result.type)).toEqual(["club", "event"]);
    expect(results[0].href).toBe("/clubs/robotics-club");
  });

  it("returns discovery hints for incomplete student setup", () => {
    expect(buildDiscoveryHints({
      joinedCategory: "Science",
      hasJoinedClubs: false,
      hasSavedOpportunities: false,
    })).toEqual([
      { label: "Start with clubs", href: "/clubs?featured=true" },
      { label: "Find deadlines", href: "/opportunities?closing=true" },
      { label: "More Science", href: "/opportunities?category=Science" },
    ]);
  });
});

function notification(id: string, type: Notification["type"], readAt: string | null): Notification {
  return {
    id,
    type,
    read_at: readAt,
    recipient_user_id: "user-1",
    importance: "normal",
    title: type,
    message: type,
    link: null,
    club_id: null,
    opportunity_id: null,
    event_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}
