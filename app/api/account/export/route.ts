import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function exportResponse(profile: NonNullable<Awaited<ReturnType<typeof getAuthContext>>["profile"]>, data?: {
  clubMemberships?: unknown[] | null;
  eventRsvps?: unknown[] | null;
  bookmarks?: unknown[] | null;
  notifications?: unknown[] | null;
}) {
  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    profile,
    club_memberships: data?.clubMemberships ?? [],
    event_rsvps: data?.eventRsvps ?? [],
    bookmarks: data?.bookmarks ?? [],
    notifications: data?.notifications ?? [],
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
  if (!supabase) {
    return NextResponse.json({ error: "Could not prepare the export." }, { status: 503 });
  }

  const [memberships, rsvps, bookmarks, notifications] = await Promise.all([
    supabase.from("club_memberships").select("*").eq("user_id", auth.userId),
    supabase.from("event_rsvps").select("*").eq("user_id", auth.userId),
    supabase.from("bookmarks").select("*").eq("user_id", auth.userId),
    supabase.from("notifications").select("*").eq("recipient_user_id", auth.userId),
  ]);

  const failed = [memberships, rsvps, bookmarks, notifications].find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: "Could not prepare the export." }, { status: 500 });
  }

  return exportResponse(auth.profile, {
    clubMemberships: memberships.data,
    eventRsvps: rsvps.data,
    bookmarks: bookmarks.data,
    notifications: notifications.data,
  });
}
