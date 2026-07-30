import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ExportQueryResult<T> {
  data: T | null;
  error: unknown;
}

interface ExportSection<T> {
  data: T;
  warning?: string;
}

interface PaginatedExportQuery<T> {
  order(
    column: string,
    options: { ascending: boolean },
  ): {
    range(from: number, to: number): PromiseLike<ExportQueryResult<T[]>>;
  };
}

const EXPORT_PAGE_SIZE = 500;

async function readExportSection<T>(
  section: string,
  query: () => PromiseLike<ExportQueryResult<T>>,
  fallback: T,
): Promise<ExportSection<T>> {
  try {
    const result = await query();
    if (!result.error) {
      return { data: result.data ?? fallback };
    }
  } catch {
    // A rejected database request should not prevent the remaining account data from exporting.
  }

  return {
    data: fallback,
    warning: `${section} could not be included in this export. Please try again after the latest database migrations are applied.`,
  };
}

async function readPaginatedExportSection<T>(
  section: string,
  query: () => PaginatedExportQuery<T>,
): Promise<ExportSection<T[]>> {
  const rows: T[] = [];

  try {
    for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
      const result = await query()
        .order("id", { ascending: true })
        .range(from, from + EXPORT_PAGE_SIZE - 1);
      if (result.error) break;

      const page = result.data ?? [];
      rows.push(...page);
      if (page.length < EXPORT_PAGE_SIZE) {
        return { data: rows };
      }
    }
  } catch {
    // Report the section as unavailable instead of returning a silently
    // truncated export after a later page fails.
  }

  return {
    data: [],
    warning: `${section} could not be included in this export. Please try again after the latest database migrations are applied.`,
  };
}

function exportResponse(profile: NonNullable<Awaited<ReturnType<typeof getAuthContext>>["profile"]>, data?: {
  clubMemberships?: unknown[] | null;
  eventRsvps?: unknown[] | null;
  eventAttendance?: unknown[] | null;
  opportunitySignups?: unknown[] | null;
  bookmarks?: unknown[] | null;
  notifications?: unknown[] | null;
  notificationPreferences?: unknown[] | null;
  serviceHours?: unknown[] | null;
  assignmentSubmissions?: unknown[] | null;
  authoredAssignments?: unknown[] | null;
  authoredAnnouncements?: unknown[] | null;
  authoredResources?: unknown[] | null;
  authoredOpportunities?: unknown[] | null;
  authoredEvents?: unknown[] | null;
  authoredWorkshops?: unknown[] | null;
  submissionAttachments?: unknown[] | null;
  assignmentAttachments?: unknown[] | null;
  studentDriveCopies?: unknown[] | null;
  submittedApprovalRequests?: unknown[] | null;
  reviewedApprovalRequests?: unknown[] | null;
  feedbackMessages?: unknown[] | null;
  accountDeletionRequests?: unknown[] | null;
  analyticsEvents?: unknown[] | null;
  emailOutbox?: unknown[] | null;
  digestDeliveries?: unknown[] | null;
  interestForms?: unknown[] | null;
  clubBansReceived?: unknown[] | null;
  adminAuditActions?: unknown[] | null;
  supportSessions?: unknown[] | null;
  supportAccessLog?: unknown[] | null;
  policyAcceptances?: unknown[] | null;
  googleDriveConnection?: unknown | null;
  warnings?: string[];
}) {
  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    export_warnings: data?.warnings ?? [],
    profile,
    club_memberships: data?.clubMemberships ?? [],
    event_rsvps: data?.eventRsvps ?? [],
    event_attendance: data?.eventAttendance ?? [],
    opportunity_signups: data?.opportunitySignups ?? [],
    bookmarks: data?.bookmarks ?? [],
    notifications: data?.notifications ?? [],
    notification_preferences: data?.notificationPreferences ?? [],
    service_hours: data?.serviceHours ?? [],
    assignment_submissions: data?.assignmentSubmissions ?? [],
    authored_assignments: data?.authoredAssignments ?? [],
    authored_announcements: data?.authoredAnnouncements ?? [],
    authored_resources: data?.authoredResources ?? [],
    authored_opportunities: data?.authoredOpportunities ?? [],
    authored_events: data?.authoredEvents ?? [],
    authored_workshops: data?.authoredWorkshops ?? [],
    submission_attachments: data?.submissionAttachments ?? [],
    assignment_attachments: data?.assignmentAttachments ?? [],
    student_drive_copies: data?.studentDriveCopies ?? [],
    submitted_approval_requests: data?.submittedApprovalRequests ?? [],
    reviewed_approval_requests: data?.reviewedApprovalRequests ?? [],
    feedback_messages: data?.feedbackMessages ?? [],
    account_deletion_requests: data?.accountDeletionRequests ?? [],
    analytics_events: data?.analyticsEvents ?? [],
    email_outbox: data?.emailOutbox ?? [],
    digest_deliveries: data?.digestDeliveries ?? [],
    interest_forms: data?.interestForms ?? [],
    club_bans_received: data?.clubBansReceived ?? [],
    admin_audit_actions: data?.adminAuditActions ?? [],
    platform_support_sessions: data?.supportSessions ?? [],
    platform_support_access_log: data?.supportAccessLog ?? [],
    policy_acceptances: data?.policyAcceptances ?? [],
    google_drive_connection: data?.googleDriveConnection ?? null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="stormhub-data-${exportedAt.slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth.userId || !auth.profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const profile = auth.profile;

  if (auth.isDemo) return exportResponse(profile);

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Could not prepare the export." }, { status: 503 });
  }
  // Service-role reads remain narrowly constrained to this authenticated user.
  // They recover historical authored/operational records that normal product RLS
  // intentionally does not expose in day-to-day screens.
  const trusted = admin ?? supabase;

  const [
    memberships,
    rsvps,
    eventAttendance,
    opportunitySignups,
    bookmarks,
    notifications,
    notificationPreferences,
    serviceHours,
    assignmentSubmissions,
    authoredAssignments,
    authoredAnnouncements,
    authoredResources,
    authoredOpportunities,
    authoredEvents,
    authoredWorkshops,
    submissionAttachments,
    assignmentAttachments,
    studentDriveCopies,
    submittedApprovalRequests,
    reviewedApprovalRequests,
    feedbackMessages,
    accountDeletionRequests,
    analyticsEvents,
    emailOutbox,
    digestDeliveries,
    interestForms,
    clubBansReceived,
    adminAuditActions,
    supportSessions,
    supportAccessLog,
    policyAcceptances,
    googleDriveConnection,
  ] = await Promise.all([
    readPaginatedExportSection(
      "Club memberships",
      () => supabase.from("club_memberships").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Event RSVPs",
      () => supabase.from("event_rsvps").select("*").eq("user_id", auth.userId),
    ),
    admin
      ? readPaginatedExportSection(
          "Event attendance",
          () => admin.from("club_event_attendance").select("*").eq("user_id", auth.userId),
        )
      : Promise.resolve<ExportSection<unknown[]>>({ data: [] }),
    readPaginatedExportSection(
      "Opportunity sign-ups",
      () => supabase.from("opportunity_signups").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Bookmarks",
      () => supabase.from("bookmarks").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Notifications",
      () => supabase.from("notifications").select("*").eq("recipient_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Notification preferences",
      () => supabase.from("notification_preferences").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Service hours",
      () => trusted.from("service_hours").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Assignment submissions",
      () => supabase.from("club_assignment_submissions").select("*").eq("student_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored assignments",
      () => trusted.from("club_assignments").select("*").eq("author_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored announcements",
      () => trusted.from("club_announcements").select("*").eq("author_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored resources",
      () => trusted.from("club_resources").select("*").eq("author_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored opportunities",
      () => trusted.from("opportunities").select("*").eq("author_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored events",
      () => trusted.from("events").select("*").eq("created_by", auth.userId),
    ),
    readPaginatedExportSection(
      "Authored workshops",
      () => trusted.from("workshops").select("*").eq("host_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Submission attachments",
      () => supabase.from("club_submission_attachments").select("*").eq("student_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Assignment attachments",
      () => trusted.from("club_assignment_attachments").select("*").eq("uploaded_by", auth.userId),
    ),
    readPaginatedExportSection(
      "Student Drive copies",
      () => supabase.from("club_assignment_student_copies").select("*").eq("student_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Submitted approval requests",
      () => trusted.from("approval_requests").select("*").eq("submitted_by", auth.userId),
    ),
    readPaginatedExportSection(
      "Reviewed approval requests",
      () => trusted.from("approval_requests").select("*").eq("reviewed_by", auth.userId),
    ),
    readPaginatedExportSection(
      "Feedback messages",
      () => trusted.from("feedback").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Account deletion requests",
      () => trusted.from("account_deletion_requests").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Analytics events",
      () => trusted.from("analytics_events").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Email delivery records",
      () => trusted
        .from("email_outbox")
        .select("id,recipient_user_id,recipient_email,subject,body,type,status,error_message,sent_at,created_at")
        .eq("recipient_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Digest delivery records",
      () => trusted.from("digest_deliveries").select("*").eq("user_id", auth.userId),
    ),
    profile.email
      ? readPaginatedExportSection(
          "Interest forms",
          () => trusted.from("interest_forms").select("*").eq("email", profile.email!),
        )
      : Promise.resolve<ExportSection<unknown[]>>({ data: [] }),
    readPaginatedExportSection(
      "Club bans received",
      () => trusted.from("club_member_bans").select("*").eq("user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Administrative audit actions",
      () => trusted
        .from("admin_audit_log")
        .select("id,school_id,actor_user_id,action,entity_type,entity_id,occurred_at")
        .eq("actor_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Platform support sessions",
      () => trusted.from("platform_support_sessions").select("*").eq("actor_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Platform support access log",
      () => trusted.from("platform_support_access_log").select("*").eq("actor_user_id", auth.userId),
    ),
    readPaginatedExportSection(
      "Policy acceptances",
      () => trusted.from("policy_acceptances").select("*").eq("user_id", auth.userId),
    ),
    readExportSection(
      "Google Drive connection",
      () => admin
        ? admin
            .from("google_drive_connections")
            .select("google_email,granted_scopes,created_at,updated_at")
            .eq("user_id", auth.userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      null,
    ),
  ]);

  const warnings = [
    memberships,
    rsvps,
    eventAttendance,
    opportunitySignups,
    bookmarks,
    notifications,
    notificationPreferences,
    serviceHours,
    assignmentSubmissions,
    authoredAssignments,
    authoredAnnouncements,
    authoredResources,
    authoredOpportunities,
    authoredEvents,
    authoredWorkshops,
    submissionAttachments,
    assignmentAttachments,
    studentDriveCopies,
    submittedApprovalRequests,
    reviewedApprovalRequests,
    feedbackMessages,
    accountDeletionRequests,
    analyticsEvents,
    emailOutbox,
    digestDeliveries,
    interestForms,
    clubBansReceived,
    adminAuditActions,
    supportSessions,
    supportAccessLog,
    policyAcceptances,
    googleDriveConnection,
  ].flatMap((result) => result.warning ? [result.warning] : []);

  return exportResponse(profile, {
    clubMemberships: memberships.data,
    eventRsvps: rsvps.data,
    eventAttendance: eventAttendance.data,
    opportunitySignups: opportunitySignups.data,
    bookmarks: bookmarks.data,
    notifications: notifications.data,
    notificationPreferences: notificationPreferences.data,
    serviceHours: serviceHours.data,
    assignmentSubmissions: assignmentSubmissions.data,
    authoredAssignments: authoredAssignments.data,
    authoredAnnouncements: authoredAnnouncements.data,
    authoredResources: authoredResources.data,
    authoredOpportunities: authoredOpportunities.data,
    authoredEvents: authoredEvents.data,
    authoredWorkshops: authoredWorkshops.data,
    submissionAttachments: submissionAttachments.data,
    assignmentAttachments: assignmentAttachments.data,
    studentDriveCopies: studentDriveCopies.data,
    submittedApprovalRequests: submittedApprovalRequests.data,
    reviewedApprovalRequests: reviewedApprovalRequests.data,
    feedbackMessages: feedbackMessages.data,
    accountDeletionRequests: accountDeletionRequests.data,
    analyticsEvents: analyticsEvents.data,
    emailOutbox: emailOutbox.data,
    digestDeliveries: digestDeliveries.data,
    interestForms: interestForms.data,
    clubBansReceived: clubBansReceived.data,
    adminAuditActions: adminAuditActions.data,
    supportSessions: supportSessions.data,
    supportAccessLog: supportAccessLog.data,
    policyAcceptances: policyAcceptances.data,
    googleDriveConnection: googleDriveConnection.data,
    warnings,
  });
}
