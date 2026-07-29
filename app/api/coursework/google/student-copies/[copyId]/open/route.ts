import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPlatformSupportAccess } from "@/lib/support-access";

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
    .select("assignment_id,web_url")
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
    if (club?.school_id) {
      await recordPlatformSupportAccess({
        actor: auth.profile,
        schoolId: club.school_id,
        action: "view",
        resourceType: "google_student_copy",
        resourceId: copyId,
      });
    }
  }

  return NextResponse.redirect(copy.web_url, {
    headers: { "cache-control": "private, no-store" },
  });
}
