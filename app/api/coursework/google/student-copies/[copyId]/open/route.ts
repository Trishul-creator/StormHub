import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPlatformSupportAccess } from "@/lib/support-access";
import { createReadOnlyGoogleDriveFileResponse } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ copyId: string }> }
) {
  const auth = await getAuthContext();
  if (!auth.userId || !auth.profile || auth.isDemo) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  const { copyId } = await context.params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Google Drive is unavailable." }, { status: 503 });
  }
  const { data: copy } = await supabase
    .from("club_assignment_student_copies")
    .select("assignment_id,assignment_attachment_id,google_file_id,web_url")
    .eq("id", copyId)
    .maybeSingle();
  if (!copy?.web_url) {
    return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
  }

  if (auth.profile.role === "super_admin") {
    const admin = createAdminClient();
    const { data: assignment } = admin
      ? await admin.from("club_assignments").select("club_id").eq("id", copy.assignment_id).maybeSingle()
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
      resourceType: "google_student_copy",
      resourceId: copyId,
    });
    if (!recorded) {
      return NextResponse.json(
        { error: "The private file stayed locked because support access could not be recorded." },
        { status: 403 }
      );
    }
    const { data: sourceAttachment } = admin
      ? await admin
        .from("club_assignment_attachments")
        .select("uploaded_by")
        .eq("id", copy.assignment_attachment_id)
        .maybeSingle()
      : { data: null };
    if (!sourceAttachment?.uploaded_by || !copy.google_file_id) {
      return NextResponse.json(
        { error: "The read-only file owner could not be verified." },
        { status: 403 }
      );
    }
    try {
      return await createReadOnlyGoogleDriveFileResponse({
        ownerUserId: sourceAttachment.uploaded_by,
        fileId: copy.google_file_id,
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

  return NextResponse.redirect(copy.web_url, {
    headers: { "cache-control": "private, no-store" },
  });
}
