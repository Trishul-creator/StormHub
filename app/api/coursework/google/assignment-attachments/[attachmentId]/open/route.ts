import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureGoogleDrivePermission } from "@/lib/google-drive";

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
    .from("club_assignment_attachments")
    .select("external_url,google_file_id,uploaded_by,source_type")
    .eq("id", attachmentId)
    .maybeSingle();
  if (
    !attachment
    || attachment.source_type !== "google_drive"
    || !attachment.external_url
    || !attachment.google_file_id
    || !attachment.uploaded_by
  ) {
    return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
  }
  if (auth.profile.email && attachment.uploaded_by !== auth.userId) {
    try {
      await ensureGoogleDrivePermission({
        ownerUserId: attachment.uploaded_by,
        fileId: attachment.google_file_id,
        recipientEmail: auth.profile.email,
        role: "reader",
      });
    } catch {
      return NextResponse.json(
        { error: "The teacher needs to reconnect Google Drive or restore access to this file." },
        { status: 502 }
      );
    }
  }
  return NextResponse.redirect(attachment.external_url, {
    headers: { "cache-control": "private, no-store" },
  });
}
