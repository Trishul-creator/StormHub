import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import type {
  EmailOutboxItem,
  Notification,
  NotificationImportance,
  NotificationPreferences,
  NotificationType,
} from "@/types/database";
import { cookies } from "next/headers";
import { isEmailDeliveryEnabled, isEmailOutboxEnabled, sendEmailOutboxItem } from "@/lib/email";

const defaultPreferences = (userId: string): NotificationPreferences => ({
  user_id: userId,
  in_app_enabled: true,
  club_updates_enabled: true,
  opportunity_deadlines_enabled: true,
  important_email_enabled: true,
  urgent_email_enabled: true,
  admin_attention_email_enabled: true,
  weekly_digest_enabled: false,
});

export const demoNotifications: Notification[] = [
  {
    id: "demo-notification-1",
    recipient_user_id: "demo-user",
    type: "club_announcement",
    importance: "normal",
    title: "Science Bowl practice update",
    message: "The next practice schedule is available in the club dashboard.",
    link: "/clubs/science-bowl/member",
    club_id: "c0000001-0000-4000-8000-000000000001",
    read_at: null,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    club: { id: "c0000001-0000-4000-8000-000000000001", name: "Science Bowl", slug: "science-bowl" },
  },
  {
    id: "demo-notification-2",
    recipient_user_id: "demo-user",
    type: "club_event_created",
    importance: "important",
    title: "New robotics build session",
    message: "A new build session was added to your calendar.",
    link: "/calendar",
    club_id: "c0000001-0000-4000-8000-000000000003",
    read_at: null,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    club: { id: "c0000001-0000-4000-8000-000000000003", name: "Robotics Club", slug: "robotics-club" },
  },
];

export async function getUserNotifications(userId: string | null, limit = 50): Promise<Notification[]> {
  if (!userId) return [];
  if (isDemoMode()) {
    const store = await cookies();
    const read = new Set<string>(JSON.parse(store.get("stormhub_demo_read_notifications")?.value ?? "[]"));
    return demoNotifications
      .map((item) => read.has(item.id) ? { ...item, read_at: new Date().toISOString() } : item)
      .slice(0, limit);
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*, club:clubs(id,name,slug)")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getUserNotifications]", error.message);
    return [];
  }
  return (data as Notification[]) ?? [];
}

export async function getUnreadNotificationCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  if (isDemoMode()) {
    const store = await cookies();
    const read = new Set<string>(JSON.parse(store.get("stormhub_demo_read_notifications")?.value ?? "[]"));
    return demoNotifications.filter((item) => !read.has(item.id)).length;
  }
  const supabase = await createClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("[getUnreadNotificationCount]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  if (isDemoMode()) return defaultPreferences(userId);
  const supabase = await createClient();
  if (!supabase) return defaultPreferences(userId);
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) console.error("[getNotificationPreferences]", error.message);
  return (data as NotificationPreferences | null) ?? defaultPreferences(userId);
}

export async function getEmailOutbox(): Promise<EmailOutboxItem[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("email_outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[getEmailOutbox]", error.message);
    return [];
  }
  return (data as EmailOutboxItem[]) ?? [];
}

interface CreateNotificationInput {
  recipientUserId: string;
  type: NotificationType;
  importance?: NotificationImportance;
  title: string;
  message: string;
  link?: string | null;
  clubId?: string | null;
  opportunityId?: string | null;
  eventId?: string | null;
  sendEmail?: boolean;
  adminAttention?: boolean;
}

function isClubUpdateNotification(type: NotificationType): boolean {
  return [
    "club_announcement",
    "club_event_created",
    "club_event_updated",
    "club_event_canceled",
    "club_opportunity_created",
  ].includes(type);
}

export async function createEmailOutboxItem(input: {
  recipientUserId?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  type: string;
}): Promise<string | null> {
  if (isDemoMode()) return null;
  if (!isEmailOutboxEnabled()) return null;
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[createEmailOutboxItem] SUPABASE_SERVICE_ROLE_KEY is required for trusted queue writes.");
    return null;
  }
  const { data, error } = await admin
    .from("email_outbox")
    .insert({
      recipient_user_id: input.recipientUserId ?? null,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      body: input.body,
      type: input.type,
      status: "pending",
    })
    .select("id,recipient_email,subject,body")
    .single();
  if (error) {
    console.error("[createEmailOutboxItem]", error.message);
    return null;
  }
  if (data && isEmailDeliveryEnabled()) await sendEmailOutboxItem(data);
  return data?.id ?? null;
}

export async function maybeQueueEmailForNotification(
  notification: CreateNotificationInput,
  recipientEmail: string | null,
  preferences: NotificationPreferences
): Promise<void> {
  if (!recipientEmail || notification.importance === "normal") return;
  const importance = notification.importance ?? "normal";
  const allowed =
    importance === "urgent"
      ? preferences.urgent_email_enabled
      : Boolean(notification.sendEmail && preferences.important_email_enabled);
  if (!allowed) return;
  if (notification.adminAttention && !preferences.admin_attention_email_enabled) return;
  await createEmailOutboxItem({
    recipientUserId: notification.recipientUserId,
    recipientEmail,
    subject: `[StormHub] ${notification.title}`,
    body: `${notification.message}${notification.link ? `\n\nOpen in StormHub: ${notification.link}` : ""}`,
    type: notification.type,
  });
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[createNotification] SUPABASE_SERVICE_ROLE_KEY is required for trusted notification writes.");
    return;
  }
  const [{ data: profile }, { data: preferenceRow }] = await Promise.all([
    admin.from("profiles").select("email,role").eq("id", input.recipientUserId).maybeSingle(),
    admin.from("notification_preferences").select("*").eq("user_id", input.recipientUserId).maybeSingle(),
  ]);
  if (!profile) return;
  const preferences = (preferenceRow as NotificationPreferences | null) ?? defaultPreferences(input.recipientUserId);
  if (input.clubId && isClubUpdateNotification(input.type) && !preferences.club_updates_enabled) return;
  if (input.type === "opportunity_deadline_soon" && !preferences.opportunity_deadlines_enabled) return;

  if (preferences.in_app_enabled) {
    const { error } = await admin.from("notifications").insert({
      recipient_user_id: input.recipientUserId,
      type: input.type,
      importance: input.importance ?? "normal",
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      club_id: input.clubId ?? null,
      opportunity_id: input.opportunityId ?? null,
      event_id: input.eventId ?? null,
    });
    if (error && error.code !== "23505") {
      console.error("[createNotification]", error.message);
      return;
    }
  }
  await maybeQueueEmailForNotification(input, profile.email ?? null, preferences);
}

export async function createNotificationsForClubMembers(input: {
  clubId: string;
  type: NotificationType;
  importance?: NotificationImportance;
  title: string;
  message: string;
  link: string;
  eventId?: string | null;
  opportunityId?: string | null;
  sendEmail?: boolean;
}): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { data, error } = await admin
    .from("club_memberships")
    .select("user_id, profiles!inner(role)")
    .eq("club_id", input.clubId)
    .eq("status", "active")
    .eq("profiles.role", "student");
  if (error) {
    console.error("[createNotificationsForClubMembers]", error.message);
    return;
  }
  await Promise.all(
    (data ?? []).map((row: { user_id: string }) =>
      createNotification({
        recipientUserId: row.user_id,
        type: input.type,
        importance: input.importance,
        title: input.title,
        message: input.message,
        link: input.link,
        clubId: input.clubId,
        eventId: input.eventId,
        opportunityId: input.opportunityId,
        sendEmail: input.sendEmail,
      })
    )
  );
}

export async function createNotificationsForClubSponsors(input: {
  clubId: string;
  type?: NotificationType;
  importance?: NotificationImportance;
  title: string;
  message: string;
  link: string;
  eventId?: string | null;
  sendEmail?: boolean;
  excludeUserIds?: string[];
}): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { data, error } = await admin
    .from("club_memberships")
    .select("user_id,profiles!inner(role)")
    .eq("club_id", input.clubId)
    .eq("status", "active")
    .eq("role", "sponsor")
    .eq("profiles.role", "teacher");

  if (error) {
    console.error("[createNotificationsForClubSponsors]", error.message);
    return;
  }

  const excluded = new Set(input.excludeUserIds ?? []);
  await Promise.all(
    (data ?? [])
      .filter((sponsor: { user_id: string }) => !excluded.has(sponsor.user_id))
      .map((sponsor: { user_id: string }) =>
        createNotification({
          recipientUserId: sponsor.user_id,
          type: input.type ?? "system_message",
          importance: input.importance ?? "normal",
          title: input.title,
          message: input.message,
          link: input.link,
          clubId: input.clubId,
          eventId: input.eventId,
          sendEmail: input.sendEmail,
          adminAttention: input.type === "approval_needed",
        })
      )
  );
}

export async function createEventRsvpNotifications(input: {
  eventId: string;
  studentName: string;
}): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id,title,club_id")
    .eq("id", input.eventId)
    .maybeSingle();

  if (eventError) {
    console.error("[createEventRsvpNotifications]", eventError.message);
    return;
  }
  if (!event?.club_id) return;

  await createNotificationsForClubSponsors({
    clubId: event.club_id,
    title: `New RSVP: ${input.studentName}`,
    message: `${input.studentName} RSVP'd to ${event.title}.`,
    link: `/events/${event.id}`,
    eventId: event.id,
    sendEmail: false,
  });
}

export async function createAdminAttentionNotification(input: {
  title: string;
  message: string;
  link: string;
  schoolId?: string | null;
  importance?: NotificationImportance;
  type?: NotificationType;
}): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) return;
  let query = admin.from("profiles").select("id").eq("role", "admin");
  if (input.schoolId) query = query.eq("school_id", input.schoolId);
  const { data } = await query;
  await Promise.all(
    (data ?? []).map((profile: { id: string }) =>
      createNotification({
        recipientUserId: profile.id,
        type: input.type ?? "approval_needed",
        importance: input.importance ?? "important",
        title: input.title,
        message: input.message,
        link: input.link,
        sendEmail: true,
        adminAttention: true,
      })
    )
  );
}

export async function createApprovalNeededNotifications(input: {
  schoolId: string;
  clubId?: string | null;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  if (isDemoMode()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const recipientIds = new Set<string>();
  const { data: admins, error: adminError } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", input.schoolId)
    .eq("role", "admin");

  if (adminError) {
    console.error("[createApprovalNeededNotifications admins]", adminError.message);
  }
  for (const profile of admins ?? []) recipientIds.add(profile.id);

  if (input.clubId) {
    const { data: sponsors, error: sponsorsError } = await admin
      .from("club_memberships")
      .select("user_id,profiles!inner(role)")
      .eq("club_id", input.clubId)
      .eq("status", "active")
      .eq("role", "sponsor")
      .eq("profiles.role", "teacher");

    if (sponsorsError) {
      console.error("[createApprovalNeededNotifications sponsors]", sponsorsError.message);
    }
    for (const sponsor of sponsors ?? []) recipientIds.add(sponsor.user_id);
  }

  await Promise.all(
    [...recipientIds].map((recipientUserId) =>
      createNotification({
        recipientUserId,
        type: "approval_needed",
        importance: "important",
        title: input.title,
        message: input.message,
        link: input.link,
        clubId: input.clubId ?? null,
        sendEmail: true,
        adminAttention: true,
      })
    )
  );
}

export async function createOpportunityDeadlineReminders(): Promise<number> {
  if (isDemoMode()) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: opportunities } = await admin
    .from("opportunities")
    .select("id,title,slug,deadline")
    .eq("status", "approved")
    .eq("deadline_reminder_enabled", true)
    .gte("deadline", now.toISOString())
    .lte("deadline", soon.toISOString());
  let queued = 0;
  for (const opportunity of opportunities ?? []) {
    const { data: bookmarks } = await admin
      .from("bookmarks")
      .select("user_id,profiles!inner(role)")
      .eq("opportunity_id", opportunity.id)
      .eq("profiles.role", "student");
    for (const bookmark of bookmarks ?? []) {
      await createNotification({
        recipientUserId: bookmark.user_id,
        type: "opportunity_deadline_soon",
        importance: "important",
        title: `Deadline soon: ${opportunity.title}`,
        message: "This saved opportunity closes within the next seven days.",
        link: `/opportunities/${opportunity.slug}`,
        opportunityId: opportunity.id,
        sendEmail: true,
      });
      queued += 1;
    }
  }
  return queued;
}
