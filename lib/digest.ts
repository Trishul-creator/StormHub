import "server-only";

import { getPublicSiteUrl } from "@/lib/env";
import { createEmailOutboxItem } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

type DigestSchool = { id: string; name: string; short_name?: string | null; slug: string };
type DigestEvent = { title: string; starts_at: string; location?: string | null };
type DigestOpportunity = { title: string; deadline?: string | null; event_date?: string | null; slug: string };
type DigestAnnouncement = { title: string; created_at?: string | null };
type DigestClub = { name: string; slug: string };

export type DigestContent = {
  school: DigestSchool;
  events: DigestEvent[];
  opportunities: DigestOpportunity[];
  announcements: DigestAnnouncement[];
  clubs: DigestClub[];
};

export function getDigestPeriodStart(now = new Date()): string {
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return utc.toISOString().slice(0, 10);
}

export function buildWeeklyDigestBody(content: DigestContent): string {
  const schoolName = content.school.short_name || content.school.name;
  const siteUrl = getPublicSiteUrl().replace(/\/$/, "");
  const lines = [
    `${schoolName} weekly StormHub digest`,
    "",
    section("Upcoming events", content.events.map((event) => {
      const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(new Date(event.starts_at));
      return `${event.title} - ${date}${event.location ? ` at ${event.location}` : ""}`;
    })),
    section("Opportunities and deadlines", content.opportunities.map((opportunity) => {
      const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Chicago" });
      const dates = [
        opportunity.event_date ? `Date: ${dateFormatter.format(new Date(opportunity.event_date))}` : null,
        opportunity.deadline ? `Deadline: ${dateFormatter.format(new Date(opportunity.deadline))}` : null,
      ].filter(Boolean);
      return `${opportunity.title} - ${dates.length > 0 ? dates.join(" · ") : "No date listed"}\nOpen in StormHub: ${siteUrl}/s/${content.school.slug}/opportunities`;
    })),
    section("Recent announcements", content.announcements.map((announcement) => announcement.title)),
    section("Featured clubs", content.clubs.map((club) => `${club.name}\nOpen in StormHub: ${siteUrl}/s/${content.school.slug}/clubs/${club.slug}`)),
    `Manage digest preferences: ${siteUrl}/settings`,
  ];
  return lines.filter(Boolean).join("\n");
}

function section(title: string, items: string[]): string {
  return `${title}\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- No new items this week."}\n`;
}

export async function processWeeklyDigests(now = new Date()): Promise<{
  eligible: number;
  queued: number;
  skipped: number;
  failed: number;
}> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for digest delivery.");

  const { data: preferences, error: preferenceError } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("weekly_digest_enabled", true);
  if (preferenceError) throw preferenceError;
  const userIds = (preferences ?? []).map((item) => item.user_id);
  if (userIds.length === 0) return { eligible: 0, queued: 0, skipped: 0, failed: 0 };

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,email,school_id,account_status")
    .in("id", userIds)
    .eq("account_status", "active")
    .not("email", "is", null)
    .not("school_id", "is", null);
  if (profileError) throw profileError;

  const periodStart = getDigestPeriodStart(now);
  const schoolCache = new Map<string, DigestContent>();
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles ?? []) {
    const { data: claimedDelivery, error: claimError } = await admin.rpc("claim_digest_delivery", {
      target_user_id: profile.id,
      target_school_id: profile.school_id,
      target_period_start: periodStart,
    }).maybeSingle();
    const deliveryId = typeof (claimedDelivery as { id?: unknown } | null)?.id === "string"
      ? (claimedDelivery as { id: string }).id
      : null;
    if (claimError || !deliveryId) {
      if (claimError) failed += 1;
      else skipped += 1;
      continue;
    }

    try {
      let content = schoolCache.get(profile.school_id);
      if (!content) {
        content = await loadDigestContent(profile.school_id, now);
        schoolCache.set(profile.school_id, content);
      }
      const outboxId = await createEmailOutboxItem({
        recipientUserId: profile.id,
        recipientEmail: profile.email,
        subject: `[StormHub] ${content.school.short_name || content.school.name} weekly digest`,
        body: buildWeeklyDigestBody(content),
        type: "weekly_digest",
      });
      if (!outboxId) throw new Error("Email outbox is disabled or unavailable.");
      const { data: outbox } = await admin.from("email_outbox").select("status").eq("id", outboxId).single();
      if (outbox?.status === "failed") throw new Error("Email provider rejected the digest.");
      await admin.from("digest_deliveries").update({
        status: outbox?.status === "sent" ? "sent" : "queued",
        email_outbox_id: outboxId,
        completed_at: new Date().toISOString(),
      }).eq("id", deliveryId);
      queued += 1;
    } catch (error) {
      failed += 1;
      await admin.from("digest_deliveries").update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown digest error",
        completed_at: new Date().toISOString(),
      }).eq("id", deliveryId);
    }
  }

  return { eligible: profiles?.length ?? 0, queued, skipped, failed };
}

async function loadDigestContent(schoolId: string, now: Date): Promise<DigestContent> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Database unavailable.");
  const nowIso = now.toISOString();
  const futureIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [school, events, opportunities, announcements, clubs] = await Promise.all([
    admin.from("schools").select("id,name,short_name,slug").eq("id", schoolId).single(),
    admin.from("events").select("title,starts_at,location").eq("school_id", schoolId).eq("status", "approved").eq("visibility", "public").gte("starts_at", nowIso).lte("starts_at", futureIso).order("starts_at").limit(8),
    admin.from("opportunities").select("title,deadline,event_date,slug").eq("school_id", schoolId).eq("status", "approved").eq("visibility", "public").or(`deadline.is.null,deadline.gte.${nowIso}`).order("deadline").limit(8),
    admin.from("club_announcements").select("title,created_at,clubs!inner(school_id)").eq("clubs.school_id", schoolId).eq("status", "approved").eq("visibility", "public").gte("created_at", recentIso).order("created_at", { ascending: false }).limit(8),
    admin.from("clubs").select("name,slug").eq("school_id", schoolId).eq("is_featured", true).eq("is_listed", true).in("status", ["interest_open", "active"]).limit(6),
  ]);
  const error = [school, events, opportunities, announcements, clubs].find((result) => result.error)?.error;
  if (error || !school.data) throw error ?? new Error("School not found.");
  return {
    school: school.data as DigestSchool,
    events: (events.data ?? []) as DigestEvent[],
    opportunities: (opportunities.data ?? []) as DigestOpportunity[],
    announcements: (announcements.data ?? []) as DigestAnnouncement[],
    clubs: (clubs.data ?? []) as DigestClub[],
  };
}
