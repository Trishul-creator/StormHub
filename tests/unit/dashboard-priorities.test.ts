import { describe, expect, it } from "vitest";
import {
  buildManagementDashboardPriorities,
  buildStudentDashboardPriorities,
  type ManagementDashboardAttention,
} from "@/lib/dashboard-priorities";
import type {
  Club,
  ClubAssignment,
  Event,
  Opportunity,
  StudentDashboard,
} from "@/types/database";

const now = new Date("2026-08-01T12:00:00.000Z");
const club: Club = {
  id: "club-1",
  school_id: "school-1",
  name: "Robotics",
  slug: "robotics",
  category: "STEM",
  is_featured: false,
  is_listed: true,
  status: "active",
  is_active: true,
  visibility: "public",
};

describe("dashboard priorities", () => {
  it("puts incomplete and overdue student assignments first", () => {
    const dashboard = emptyStudentDashboard();
    dashboard.upcomingAssignments = [
      assignment("late", "2026-07-30T12:00:00.000Z"),
      {
        ...assignment("submitted", "2026-08-01T18:00:00.000Z"),
        submission: {
          id: "submission-1",
          assignment_id: "submitted",
          student_id: "student-1",
          status: "submitted",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      },
    ];
    dashboard.savedOpportunities = [
      opportunity("science-fair", "2026-08-03T12:00:00.000Z"),
    ];
    dashboard.upcomingEvents = [
      event("meeting", "2026-08-02T12:00:00.000Z"),
    ];

    const priorities = buildStudentDashboardPriorities(dashboard, now);

    expect(priorities.map((item) => item.id)).toEqual([
      "assignment:late",
      "opportunity:science-fair",
      "event:meeting",
    ]);
    expect(priorities[0]).toMatchObject({
      urgency: "urgent",
      timing: "Due 2d ago",
      href: "/clubs/robotics/member/assignments/late",
    });
  });

  it("combines grading, approvals, coursework, and events into four management items", () => {
    const managedAssignment = assignment(
      "project",
      "2026-08-02T12:00:00.000Z"
    );
    const upcomingAssignment = assignment(
      "presentation",
      "2026-08-04T12:00:00.000Z"
    );
    const attention: ManagementDashboardAttention = {
      grading: [{ assignment: managedAssignment, submittedCount: 3 }],
      upcomingAssignments: [managedAssignment, upcomingAssignment],
      upcomingEvents: [event("showcase", "2026-08-05T12:00:00.000Z")],
    };

    const priorities = buildManagementDashboardPriorities({
      attention,
      approvals: [
        {
          id: "post-1",
          type: "announcement",
          title: "Competition update",
          context: "Robotics",
        },
      ],
      includeGrading: true,
      now,
    });

    expect(priorities).toHaveLength(4);
    expect(priorities[0]).toMatchObject({
      id: "grading:project",
      actionLabel: "Review work",
    });
    expect(priorities.some((item) => item.kind === "approval")).toBe(true);
    expect(priorities.some((item) => item.kind === "event")).toBe(true);
  });
});

function emptyStudentDashboard(): StudentDashboard {
  return {
    memberships: [],
    upcomingEvents: [],
    upcomingAssignments: [],
    savedOpportunities: [],
    recommendedOpportunities: [],
    recentAnnouncements: [],
  };
}

function assignment(id: string, dueAt: string): ClubAssignment & { club: Club } {
  return {
    id,
    club_id: club.id,
    title: `Assignment ${id}`,
    instructions: "Complete the work.",
    due_at: dueAt,
    points_possible: 100,
    submission_mode: "submission",
    status: "published",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    club,
  };
}

function opportunity(id: string, deadline: string): Opportunity {
  return {
    id,
    school_id: "school-1",
    title: "Science Fair",
    slug: id,
    category: "STEM",
    deadline,
    status: "approved",
    visibility: "public",
  };
}

function event(id: string, startsAt: string): Event {
  return {
    id,
    school_id: "school-1",
    club_id: club.id,
    title: `Event ${id}`,
    event_type: "meeting",
    starts_at: startsAt,
    status: "approved",
    visibility: "members",
    club,
  };
}
