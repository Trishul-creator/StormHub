import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ scope: string; attachmentId: string }> }
) {
  const auth = await getAuthContext();
  if (!auth.userId || !auth.profile || auth.isDemo) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  const { scope, attachmentId } = await context.params;
  const table = scope === "assignment"
    ? "club_assignment_attachments"
    : scope === "submission" ? "club_submission_attachments" : null;
  if (!table) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Private file storage is unavailable." }, { status: 503 });
  }
  const { data: attachment, error } = await supabase
    .from(table)
    .select("storage_path,source_type,file_name")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error || !attachment || attachment.source_type !== "upload" || !attachment.storage_path) {
    return NextResponse.json({ error: "Attachment not found or access denied." }, { status: 404 });
  }
  const { data: signed, error: signedError } = await admin.storage
    .from("coursework-private")
    .createSignedUrl(attachment.storage_path, 60, {
      download: attachment.file_name,
    });
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not prepare the private download." }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, {
    headers: { "cache-control": "private, no-store" },
  });
}
