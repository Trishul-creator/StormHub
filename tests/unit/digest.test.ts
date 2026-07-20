import { describe, expect, it } from "vitest";
import { buildWeeklyDigestBody, getDigestPeriodStart } from "@/lib/digest";

describe("weekly digest", () => {
  it("uses Monday as the idempotency period start", () => {
    expect(getDigestPeriodStart(new Date("2026-07-20T15:00:00Z"))).toBe("2026-07-20");
    expect(getDigestPeriodStart(new Date("2026-07-26T15:00:00Z"))).toBe("2026-07-20");
  });

  it("renders school-scoped links and useful empty sections", () => {
    const body = buildWeeklyDigestBody({
      school: { id: "school-1", name: "Storm High", slug: "storm-high" },
      events: [{ title: "Club Fair", starts_at: "2026-07-21T18:00:00Z", location: "Commons" }],
      opportunities: [{ title: "Leadership Team", deadline: "2026-07-30T05:00:00Z", slug: "leadership" }],
      announcements: [],
      clubs: [{ name: "Robotics", slug: "robotics" }],
    });
    expect(body).toContain("Storm High weekly StormHub digest");
    expect(body).toContain("Club Fair");
    expect(body).toContain("https://stormhubapp.com/s/storm-high/clubs/robotics");
    expect(body).toContain("No new items this week");
    expect(body).toContain("Manage digest preferences: https://stormhubapp.com/settings");
  });
});
