import "server-only";

import { createNotificationsForClubMembers } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

interface ScheduledAssignment {
  id: string;
  club_id: string;
  title: string;
  due_at: string | null;
  scheduled_for: string;
}

interface ScheduledAnnouncement {
  id: string;
  club_id: string;
  title: string;
  importance: "normal" | "important" | "urgent";
  send_email_to_members: boolean;
  scheduled_for: string;
}

interface ClubSummary {
  id: string;
  name: string;
  slug: string;
}

async function getClub(clubId: string): Promise<ClubSummary | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("clubs")
    .select("id,name,slug")
    .eq("id", clubId)
    .maybeSingle();
  if (error) {
    console.error("[scheduled content club]", error.message);
    return null;
  }
  return data as ClubSummary | null;
}

export async function publishScheduledClubContent(now = new Date()): Promise<{
  assignmentsPublished: number;
  announcementsPublished: number;
}> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");

  const nowIso = now.toISOString();
  const [{ data: assignmentRows, error: assignmentError }, { data: announcementRows, error: announcementError }] =
    await Promise.all([
      admin
        .from("club_assignments")
        .select("id,club_id,title,due_at,scheduled_for")
        .eq("status", "draft")
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", nowIso)
        .limit(100),
      admin
        .from("club_announcements")
        .select("id,club_id,title,importance,send_email_to_members,scheduled_for")
        .eq("status", "draft")
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", nowIso)
        .limit(100),
    ]);

  if (assignmentError) throw new Error(`Could not load scheduled assignments: ${assignmentError.message}`);
  if (announcementError) throw new Error(`Could not load scheduled announcements: ${announcementError.message}`);

  let assignmentsPublished = 0;
  let announcementsPublished = 0;

  for (const candidate of (assignmentRows ?? []) as ScheduledAssignment[]) {
    const { data: claimed, error } = await admin
      .from("club_assignments")
      .update({
        status: "published",
        published_at: nowIso,
        scheduled_for: null,
      })
      .eq("id", candidate.id)
      .eq("status", "draft")
      .eq("scheduled_for", candidate.scheduled_for)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[scheduled assignment publish]", error.message);
      continue;
    }
    if (!claimed) continue;
    assignmentsPublished += 1;

    const club = await getClub(candidate.club_id);
    if (club) {
      await createNotificationsForClubMembers({
        clubId: club.id,
        type: "club_assignment_created",
        importance: "normal",
        title: candidate.title,
        message: `${club.name} posted a new assignment${candidate.due_at ? ` due ${new Date(candidate.due_at).toLocaleDateString()}` : ""}.`,
        link: `/clubs/${club.slug}/member/assignments/${candidate.id}`,
        sendEmail: false,
      });
    }
  }

  for (const candidate of (announcementRows ?? []) as ScheduledAnnouncement[]) {
    const { data: claimed, error } = await admin
      .from("club_announcements")
      .update({
        status: "approved",
        published_at: nowIso,
        scheduled_for: null,
      })
      .eq("id", candidate.id)
      .eq("status", "draft")
      .eq("scheduled_for", candidate.scheduled_for)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[scheduled announcement publish]", error.message);
      continue;
    }
    if (!claimed) continue;
    announcementsPublished += 1;

    const club = await getClub(candidate.club_id);
    if (club) {
      await createNotificationsForClubMembers({
        clubId: club.id,
        type: "club_announcement",
        importance: candidate.importance,
        title: candidate.title,
        message: `A new announcement was posted in ${club.name}.`,
        link: `/clubs/${club.slug}/member`,
        sendEmail: candidate.send_email_to_members,
      });
    }
  }

  return { assignmentsPublished, announcementsPublished };
}
