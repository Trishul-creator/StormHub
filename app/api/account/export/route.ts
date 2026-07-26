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

function exportResponse(profile: NonNullable<Awaited<ReturnType<typeof getAuthContext>>["profile"]>, data?: {
  clubMemberships?: unknown[] | null;
  eventRsvps?: unknown[] | null;
  bookmarks?: unknown[] | null;
  notifications?: unknown[] | null;
  assignmentSubmissions?: unknown[] | null;
  authoredAssignments?: unknown[] | null;
  submissionAttachments?: unknown[] | null;
  assignmentAttachments?: unknown[] | null;
  studentDriveCopies?: unknown[] | null;
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
    bookmarks: data?.bookmarks ?? [],
    notifications: data?.notifications ?? [],
    assignment_submissions: data?.assignmentSubmissions ?? [],
    authored_assignments: data?.authoredAssignments ?? [],
    submission_attachments: data?.submissionAttachments ?? [],
    assignment_attachments: data?.assignmentAttachments ?? [],
    student_drive_copies: data?.studentDriveCopies ?? [],
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

  if (auth.isDemo) return exportResponse(auth.profile);

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Could not prepare the export." }, { status: 503 });
  }

  const [
    memberships,
    rsvps,
    bookmarks,
    notifications,
    assignmentSubmissions,
    authoredAssignments,
    submissionAttachments,
    assignmentAttachments,
    studentDriveCopies,
    googleDriveConnection,
  ] = await Promise.all([
    readExportSection(
      "Club memberships",
      () => supabase.from("club_memberships").select("*").eq("user_id", auth.userId),
      [],
    ),
    readExportSection(
      "Event RSVPs",
      () => supabase.from("event_rsvps").select("*").eq("user_id", auth.userId),
      [],
    ),
    readExportSection(
      "Bookmarks",
      () => supabase.from("bookmarks").select("*").eq("user_id", auth.userId),
      [],
    ),
    readExportSection(
      "Notifications",
      () => supabase.from("notifications").select("*").eq("recipient_user_id", auth.userId),
      [],
    ),
    readExportSection(
      "Assignment submissions",
      () => supabase.from("club_assignment_submissions").select("*").eq("student_id", auth.userId),
      [],
    ),
    readExportSection(
      "Authored assignments",
      () => supabase.from("club_assignments").select("*").eq("author_id", auth.userId),
      [],
    ),
    readExportSection(
      "Submission attachments",
      () => supabase.from("club_submission_attachments").select("*").eq("student_id", auth.userId),
      [],
    ),
    readExportSection(
      "Assignment attachments",
      () => supabase.from("club_assignment_attachments").select("*").eq("uploaded_by", auth.userId),
      [],
    ),
    readExportSection(
      "Student Drive copies",
      () => supabase.from("club_assignment_student_copies").select("*").eq("student_id", auth.userId),
      [],
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
    bookmarks,
    notifications,
    assignmentSubmissions,
    authoredAssignments,
    submissionAttachments,
    assignmentAttachments,
    studentDriveCopies,
    googleDriveConnection,
  ].flatMap((result) => result.warning ? [result.warning] : []);

  return exportResponse(auth.profile, {
    clubMemberships: memberships.data,
    eventRsvps: rsvps.data,
    bookmarks: bookmarks.data,
    notifications: notifications.data,
    assignmentSubmissions: assignmentSubmissions.data,
    authoredAssignments: authoredAssignments.data,
    submissionAttachments: submissionAttachments.data,
    assignmentAttachments: assignmentAttachments.data,
    studentDriveCopies: studentDriveCopies.data,
    googleDriveConnection: googleDriveConnection.data,
    warnings,
  });
}
