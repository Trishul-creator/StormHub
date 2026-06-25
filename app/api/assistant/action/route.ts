import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export const runtime = "nodejs";

type AssistantActionType =
  | "mark_notifications_read"
  | "rsvp_event"
  | "remove_rsvp"
  | "save_opportunity";

type AssistantActionRequest = {
  type?: AssistantActionType;
  eventId?: string;
  opportunityId?: string;
};

function isUuidish(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F-]{20,}$/.test(value);
}

export async function POST(request: NextRequest) {
  let body: AssistantActionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid action request." }, { status: 400 });
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  if (body.type === "mark_notifications_read") {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", profile.id)
      .is("read_at", null);
    if (error) return NextResponse.json({ error: "Could not mark notifications read." }, { status: 500 });
    revalidatePath("/notifications");
    return NextResponse.json({ success: true, message: "Marked your notifications as read." });
  }

  if (body.type === "rsvp_event" || body.type === "remove_rsvp") {
    if (profile.role !== "student") {
      return NextResponse.json({ error: "Only student accounts can manage RSVPs." }, { status: 403 });
    }
    if (!isUuidish(body.eventId)) {
      return NextResponse.json({ error: "Missing event ID." }, { status: 400 });
    }
    if (body.type === "rsvp_event") {
      const { error } = await supabase
        .from("event_rsvps")
        .upsert(
          { event_id: body.eventId, user_id: profile.id, status: "going" },
          { onConflict: "event_id,user_id" }
        );
      if (error) return NextResponse.json({ error: "Could not RSVP to that event." }, { status: 500 });
      revalidatePath(`/events/${body.eventId}`);
      revalidatePath("/calendar");
      return NextResponse.json({ success: true, message: "RSVP confirmed." });
    }
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", body.eventId)
      .eq("user_id", profile.id);
    if (error) return NextResponse.json({ error: "Could not remove that RSVP." }, { status: 500 });
    revalidatePath(`/events/${body.eventId}`);
    revalidatePath("/calendar");
    return NextResponse.json({ success: true, message: "RSVP removed." });
  }

  if (body.type === "save_opportunity") {
    if (profile.role !== "student") {
      return NextResponse.json({ error: "Only student accounts can save opportunities." }, { status: 403 });
    }
    if (!isUuidish(body.opportunityId)) {
      return NextResponse.json({ error: "Missing opportunity ID." }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", profile.id)
      .eq("opportunity_id", body.opportunityId)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("bookmarks")
        .insert({ user_id: profile.id, opportunity_id: body.opportunityId });
      if (error) return NextResponse.json({ error: "Could not save that opportunity." }, { status: 500 });
    }
    revalidatePath("/opportunities");
    revalidatePath("/saved");
    return NextResponse.json({ success: true, message: "Opportunity saved." });
  }

  return NextResponse.json({ error: "Unsupported assistant action." }, { status: 400 });
}
