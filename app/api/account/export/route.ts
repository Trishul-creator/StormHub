import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthContext();
  const supabase = await createClient();
  if (!auth.userId || !auth.profile || !supabase) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [memberships, rsvps, bookmarks, notifications, deletionRequests] = await Promise.all([
    supabase.from("club_memberships").select("*").eq("user_id", auth.userId),
    supabase.from("event_rsvps").select("*").eq("user_id", auth.userId),
    supabase.from("bookmarks").select("*").eq("user_id", auth.userId),
    supabase.from("notifications").select("*").eq("recipient_user_id", auth.userId),
    supabase.from("account_deletion_requests").select("*").eq("user_id", auth.userId),
  ]);

  const failed = [memberships, rsvps, bookmarks, notifications, deletionRequests].find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: "Could not prepare the export." }, { status: 500 });
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    profile: auth.profile,
    club_memberships: memberships.data ?? [],
    event_rsvps: rsvps.data ?? [],
    bookmarks: bookmarks.data ?? [],
    notifications: notifications.data ?? [],
    account_deletion_requests: deletionRequests.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="stormhub-data-${exportedAt.slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
