import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatisticsDashboard } from "@/components/admin/statistics-dashboard";
import type { AdminStatistics } from "@/types/database";

const statistics: AdminStatistics = {
  scopeSchoolId: "school-a",
  totalPeople: 120,
  activePeople: 116,
  engagedPeople30d: 78,
  newPeople30d: 14,
  totalClubs: 10,
  activeClubs: 7,
  activeMemberships: 182,
  upcomingEvents: 9,
  engagementEvents30d: 84,
  roleDistribution: [
    { role: "student", count: 100 },
    { role: "teacher", count: 14 },
    { role: "admin", count: 6 },
    { role: "super_admin", count: 0 },
  ],
  clubStatusDistribution: [
    { status: "active", count: 7 },
    { status: "interest_open", count: 1 },
    { status: "draft", count: 1 },
    { status: "paused", count: 1 },
    { status: "archived", count: 0 },
  ],
  monthlyActivity: [
    { month: "2026-02", newPeople: 4, newMemberships: 7, engagementEvents: 20 },
    { month: "2026-03", newPeople: 6, newMemberships: 9, engagementEvents: 28 },
    { month: "2026-04", newPeople: 8, newMemberships: 12, engagementEvents: 34 },
    { month: "2026-05", newPeople: 10, newMemberships: 15, engagementEvents: 48 },
    { month: "2026-06", newPeople: 12, newMemberships: 18, engagementEvents: 62 },
    { month: "2026-07", newPeople: 14, newMemberships: 21, engagementEvents: 84 },
  ],
  topClubs: [
    {
      id: "club-1",
      name: "Robotics Club",
      slug: "robotics",
      status: "active",
      members: 42,
      recentEvents: 4,
      recentActivity: 12,
      score: 66,
    },
  ],
};

describe("StatisticsDashboard", () => {
  it("renders accessible summaries, charts, and active-club rankings", () => {
    render(<StatisticsDashboard statistics={statistics} />);

    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Engaged in 30 days")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Six-month activity line graph/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Six-month activity data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People by role" })).toBeInTheDocument();
    expect(screen.getByText("Robotics Club")).toBeInTheDocument();
    expect(screen.getByText(/aggregated and do not expose individual activity/i)).toBeInTheDocument();
  });
});
