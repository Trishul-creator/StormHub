import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReadOnlyGoogleDriveFileResponse,
  ensureGoogleDrivePermission,
} from "@/lib/google-drive";
import { recordPlatformSupportAccess } from "@/lib/support-access";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const auth = await getAuthContext();
  if (!auth.userId || !auth.profile || auth.isDemo) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { attachmentId } = await context.params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Google Drive is unavailable." }, { status: 503 });
  }

  const { data: attachment } = await supabase
    .from("club_submission_attachments")
    .select("assignment_id,external_url,google_file_id,student_id,source_type")
    .eq("id", attachmentId)
    .maybeSingle();
  if (
    !attachment
    || attachment.source_type !== "google_drive"
    || !attachment.external_url
    || !attachment.google_file_id
  ) {
    return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
  }

  if (auth.profile.role === "super_admin") {
    const admin = createAdminClient();
    const { data: assignment } = admin
      ? await admin
        .from("club_assignments")
        .select("club_id")
        .eq("id", attachment.assignment_id)
        .maybeSingle()
      : { data: null };
    const { data: club } = admin && assignment?.club_id
      ? await admin.from("clubs").select("school_id").eq("id", assignment.club_id).maybeSingle()
      : { data: null };
    if (!club?.school_id) {
      return NextResponse.json({ error: "Support access could not be verified." }, { status: 403 });
    }
    const recorded = await recordPlatformSupportAccess({
      actor: auth.profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "google_submission_attachment",
      resourceId: attachmentId,
    });
    if (!recorded) {
      return NextResponse.json(
        { error: "The private file stayed locked because support access could not be recorded." },
        { status: 403 }
      );
    }
    try {
      return await createReadOnlyGoogleDriveFileResponse({
        ownerUserId: attachment.student_id,
        fileId: attachment.google_file_id,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error
            ? error.message
            : "Google Drive could not prepare the read-only support preview.",
        },
        { status: 502 }
      );
    }
  }

  if (auth.profile.email && attachment.student_id !== auth.userId) {
    try {
      await ensureGoogleDrivePermission({
        ownerUserId: attachment.student_id,
        fileId: attachment.google_file_id,
        recipientEmail: auth.profile.email,
        role: "reader",
      });
    } catch {
      return NextResponse.json(
        { error: "The student needs to reconnect Google Drive or restore access to this file." },
        { status: 502 }
      );
    }
  }

  return NextResponse.redirect(attachment.external_url, {
    headers: { "cache-control": "private, no-store" },
  });
}
