import type {
  Club,
  ClubAssignment,
  Event,
  PendingApprovalItem,
  StudentDashboard,
} from "@/types/database";

export type DashboardPriorityKind =
  | "assignment"
  | "deadline"
  | "event"
  | "approval"
  | "grading"
  | "school";

export type DashboardPriorityUrgency = "urgent" | "soon" | "normal";

export interface DashboardPriorityItem {
  id: string;
  kind: DashboardPriorityKind;
  urgency: DashboardPriorityUrgency;
  title: string;
  detail: string;
  timing: string;
  href: string;
  actionLabel: string;
  score: number;
}

export interface ManagementDashboardAttention {
  upcomingEvents: (Event & { club?: Club | null })[];
  upcomingAssignments: (ClubAssignment & { club?: Club | null })[];
  grading: Array<{
    assignment: ClubAssignment & { club?: Club | null };
    submittedCount: number;
  }>;
}

const dayMs = 24 * 60 * 60 * 1000;

function daysUntil(value: string, now: Date) {
  return Math.ceil((new Date(value).getTime() - now.getTime()) / dayMs);
}

function timingLabel(value: string, now: Date, prefix: "Due" | "Closes" | "Starts") {
  const days = daysUntil(value, now);
  if (days < 0) return `${prefix} ${Math.abs(days)}d ago`;
  if (days === 0) return `${prefix} today`;
  if (days === 1) return `${prefix} tomorrow`;
  if (days <= 14) return `${prefix} in ${days}d`;
  return `${prefix} ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value))}`;
}

function urgencyForDays(days: number): DashboardPriorityUrgency {
  if (days <= 1) return "urgent";
  if (days <= 7) return "soon";
  return "normal";
}

export function buildStudentDashboardPriorities(
  dashboard: StudentDashboard,
  now = new Date()
): DashboardPriorityItem[] {
  const assignmentItems = dashboard.upcomingAssignments
    .filter((assignment) => !assignment.submission || assignment.submission.status === "draft")
    .map((assignment): DashboardPriorityItem => {
      const days = assignment.due_at ? daysUntil(assignment.due_at, now) : 30;
      return {
        id: `assignment:${assignment.id}`,
        kind: "assignment",
        urgency: urgencyForDays(days),
        title: assignment.title,
        detail: assignment.club?.name ?? "Club assignment",
        timing: assignment.due_at ? timingLabel(assignment.due_at, now, "Due") : "No due date",
        href: assignment.club
          ? `/clubs/${assignment.club.slug}/member/assignments/${assignment.id}`
          : "/dashboard",
        actionLabel: "Open assignment",
        score: days < 0 ? -20 + days : days,
      };
    });

  const deadlineItems = dashboard.savedOpportunities
    .filter((opportunity) => opportunity.deadline && daysUntil(opportunity.deadline, now) >= 0)
    .map((opportunity): DashboardPriorityItem => {
      const days = daysUntil(opportunity.deadline!, now);
      return {
        id: `opportunity:${opportunity.id}`,
        kind: "deadline",
        urgency: urgencyForDays(days),
        title: opportunity.title,
        detail: opportunity.category ?? "Saved opportunity",
        timing: timingLabel(opportunity.deadline!, now, "Closes"),
        href: `/opportunities/${opportunity.slug}`,
        actionLabel: "View opportunity",
        score: days + 3,
      };
    });

  const eventItems = dashboard.upcomingEvents
    .filter((event) => daysUntil(event.starts_at, now) >= 0)
    .map((event): DashboardPriorityItem => {
      const days = daysUntil(event.starts_at, now);
      return {
        id: `event:${event.id}`,
        kind: "event",
        urgency: days <= 1 ? "soon" : "normal",
        title: event.title,
        detail: event.club?.name ?? event.location ?? "School event",
        timing: timingLabel(event.starts_at, now, "Starts"),
        href: `/events/${event.id}`,
        actionLabel: "View event",
        score: days + 8,
      };
    });

  return [...assignmentItems, ...deadlineItems, ...eventItems]
    .sort((left, right) => left.score - right.score)
    .slice(0, 4);
}

export function buildManagementDashboardPriorities({
  attention,
  approvals,
  includeGrading,
  includeCoursework = includeGrading,
  now = new Date(),
}: {
  attention: ManagementDashboardAttention;
  approvals: PendingApprovalItem[];
  includeGrading: boolean;
  includeCoursework?: boolean;
  now?: Date;
}): DashboardPriorityItem[] {
  const approvalItems = approvals.slice(0, 3).map((item, index): DashboardPriorityItem => ({
    id: `approval:${item.type}:${item.id}`,
    kind: "approval",
    urgency: index === 0 ? "soon" : "normal",
    title: item.title,
    detail: `${item.context ?? "School content"} · ${item.type}`,
    timing: "Awaiting review",
    href: "/manage/approvals",
    actionLabel: "Review",
    score: 4 + index,
  }));

  const gradingItems = includeGrading
    ? attention.grading.map(({ assignment, submittedCount }): DashboardPriorityItem => ({
        id: `grading:${assignment.id}`,
        kind: "grading",
        urgency: assignment.due_at && daysUntil(assignment.due_at, now) <= 1 ? "urgent" : "soon",
        title: assignment.title,
        detail: `${assignment.club?.name ?? "Club"} · ${submittedCount} submission${submittedCount === 1 ? "" : "s"}`,
        timing: "Ready to grade",
        href: assignment.club
          ? `/manage/clubs/${assignment.club.slug}/coursework/${assignment.id}`
          : "/manage",
        actionLabel: "Review work",
        score: assignment.due_at ? daysUntil(assignment.due_at, now) : 6,
      }))
    : [];
  const gradingAssignmentIds = new Set(
    attention.grading.map(({ assignment }) => assignment.id)
  );

  const assignmentItems = includeCoursework
    ? attention.upcomingAssignments
        .filter(
          (assignment) =>
            !gradingAssignmentIds.has(assignment.id) &&
            assignment.due_at &&
            daysUntil(assignment.due_at, now) >= 0
        )
        .map((assignment): DashboardPriorityItem => {
          const days = daysUntil(assignment.due_at!, now);
          return {
            id: `managed-assignment:${assignment.id}`,
            kind: "assignment",
            urgency: urgencyForDays(days),
            title: assignment.title,
            detail: assignment.club?.name ?? "Club assignment",
            timing: timingLabel(assignment.due_at!, now, "Due"),
            href: assignment.club
              ? `/manage/clubs/${assignment.club.slug}/coursework/${assignment.id}`
              : "/manage",
            actionLabel: "Open coursework",
            score: days + 10,
          };
        })
    : [];

  const eventItems = attention.upcomingEvents.map((event): DashboardPriorityItem => {
    const days = daysUntil(event.starts_at, now);
    return {
      id: `managed-event:${event.id}`,
      kind: "event",
      urgency: days <= 1 ? "soon" : "normal",
      title: event.title,
      detail: event.club?.name ?? event.location ?? "School event",
      timing: timingLabel(event.starts_at, now, "Starts"),
      href: `/events/${event.id}`,
      actionLabel: "View event",
      score: days + 18,
    };
  });

  return [...gradingItems, ...approvalItems, ...assignmentItems, ...eventItems]
    .sort((left, right) => left.score - right.score)
    .slice(0, 4);
}
