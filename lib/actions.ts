"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import { createProfileIfMissing, getAuthUserId, getCurrentProfile } from "@/lib/auth";
import { demoState } from "@/lib/data/demo-data";
import { getClubBySlug } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import {
  canApproveContent,
  canApproveClubContent,
  canDeleteUser,
  canEditRole,
  canManageClub,
  canManageClubRoster,
  isAdminRole,
} from "@/lib/permissions";
import type {
  ApprovalContentType,
  ClubMembership,
  MembershipRole,
  Profile,
  UserRole,
  FeedbackStatus,
} from "@/types/database";
import { slugify } from "@/lib/utils";
import {
  createAdminAttentionNotification,
  createApprovalNeededNotifications,
  createEmailOutboxItem,
  createEventRsvpNotifications,
  createNotification,
  createNotificationsForClubMembers,
  createNotificationsForClubSponsors,
  createOpportunityDeadlineReminders,
} from "@/lib/notifications";
import { processEmailOutbox } from "@/lib/email";
import type { NotificationImportance, NotificationPreferences } from "@/types/database";

const DEMO_USER_COOKIE = "stormhub_demo_user";
const DEMO_EMAIL_COOKIE = "stormhub_demo_email";
const DEMO_MEMBERSHIPS_COOKIE = "stormhub_demo_memberships";
const DEMO_BOOKMARKS_COOKIE = "stormhub_demo_bookmarks";
const DEMO_RSVPS_COOKIE = "stormhub_demo_rsvps";
const DEMO_READ_NOTIFICATIONS_COOKIE = "stormhub_demo_read_notifications";

function formatMembershipRole(role: MembershipRole): string {
  return role.replace(/_/g, " ");
}

function contentReviewLink(contentType: ApprovalContentType, content: Record<string, unknown> | null, club?: { slug: string } | null): string {
  if (contentType === "event" && typeof content?.id === "string") return `/events/${content.id}`;
  if (contentType === "opportunity" && typeof content?.slug === "string") return `/opportunities/${content.slug}`;
  if (club?.slug) return `/clubs/${club.slug}/member`;
  if (contentType === "workshop") return "/workshops";
  return "/dashboard";
}

async function getDemoMemberships(): Promise<Set<string>> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_MEMBERSHIPS_COOKIE)?.value;
  if (raw) {
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }
  return demoState.memberships;
}

async function setDemoMemberships(memberships: Set<string>) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_MEMBERSHIPS_COOKIE, JSON.stringify([...memberships]), {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  demoState.memberships = memberships;
}

export async function getDemoUserId(): Promise<string | null> {
  if (!isDemoMode()) return getAuthUserId();
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_USER_COOKIE)?.value ?? null;
}

export async function joinClub(clubSlug: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) return { success: false, error: "Please sign in to join clubs." };
    const profile = await getCurrentProfile();
    if (profile?.role !== "student") {
      return { success: false, error: "Only student accounts can join clubs." };
    }
    const memberships = await getDemoMemberships();
    memberships.add(clubSlug);
    await setDemoMemberships(memberships);
    revalidatePath(`/clubs/${clubSlug}`);
    revalidatePath(`/clubs/${clubSlug}/member`);
    revalidatePath("/dashboard");
    revalidatePath("/my-clubs");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to join clubs." };

  const profile = await createProfileIfMissing(user.id, user.email ?? "");
  if (!profile || profile.role !== "student") {
    return { success: false, error: "Only student accounts can join clubs." };
  }

  const club = await getClubBySlug(clubSlug);
  if (!club) return { success: false, error: "Club not found." };
  if (!["interest_open", "active"].includes(club.status) || !club.is_listed || club.visibility !== "public") {
    return { success: false, error: "This club is not currently open for students to join." };
  }

  const { data: existingMembership } = await supabase
    .from("club_memberships")
    .select("status")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMembership?.status === "rejected") {
    return { success: false, error: "A teacher or administrator has blocked this account from rejoining this club." };
  }

  const { error } = await supabase.from("club_memberships").upsert(
    { club_id: club.id, user_id: user.id, status: "active", role: "member" },
    { onConflict: "club_id,user_id" }
  );

  if (error) return { success: false, error: friendlyError(error, "Could not join club.") };

  await createNotificationsForClubSponsors({
    clubId: club.id,
    title: `New member joined: ${profile.full_name ?? profile.email ?? "Student"}`,
    message: `${profile.full_name ?? profile.email ?? "A student"} joined ${club.name}.`,
    link: `/manage/clubs/${club.slug}/members`,
  });

  revalidatePath(`/clubs/${clubSlug}`);
  revalidatePath(`/clubs/${clubSlug}/member`);
  revalidatePath("/dashboard");
  revalidatePath("/my-clubs");
  return { success: true };
}

export async function leaveClub(clubSlug: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const memberships = await getDemoMemberships();
    memberships.delete(clubSlug);
    await setDemoMemberships(memberships);
    revalidatePath(`/clubs/${clubSlug}`);
    revalidatePath("/dashboard");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const club = await getClubBySlug(clubSlug);
  if (!club) return { success: false, error: "Club not found." };

  const { error } = await supabase
    .from("club_memberships")
    .update({ status: "left" })
    .eq("club_id", club.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: friendlyError(error) };

  const profile = await getCurrentProfile();
  await createNotificationsForClubSponsors({
    clubId: club.id,
    title: `Member left: ${profile?.full_name ?? user.email ?? "Student"}`,
    message: `${profile?.full_name ?? user.email ?? "A student"} left ${club.name}.`,
    link: `/manage/clubs/${club.slug}/members`,
  });

  revalidatePath(`/clubs/${clubSlug}`);
  revalidatePath(`/clubs/${clubSlug}/member`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rsvpToEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) return { success: false, error: "Please sign in to RSVP." };
    const profile = await getCurrentProfile();
    if (profile?.role !== "student") {
      return { success: false, error: "Only student accounts can RSVP to events." };
    }
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_RSVPS_COOKIE)?.value;
    const rsvps = raw ? new Set(JSON.parse(raw) as string[]) : new Set(demoState.rsvps);
    rsvps.add(eventId);
    cookieStore.set(DEMO_RSVPS_COOKIE, JSON.stringify([...rsvps]), { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    demoState.rsvps = rsvps;
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to RSVP." };

  const profile = await createProfileIfMissing(user.id, user.email ?? "");
  if (!profile || profile.role !== "student") {
    return { success: false, error: "Only student accounts can RSVP to events." };
  }

  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, user_id: user.id, status: "going" },
    { onConflict: "event_id,user_id" }
  );

  if (error) return { success: false, error: friendlyError(error) };

  await createEventRsvpNotifications({
    eventId,
    studentName: profile.full_name || profile.email || "A student",
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true };
}

export async function cancelRsvp(eventId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const profile = await getCurrentProfile();
    if (profile?.role !== "student") {
      return { success: false, error: "Only student accounts can manage RSVPs." };
    }
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_RSVPS_COOKIE)?.value;
    const rsvps = raw ? new Set(JSON.parse(raw) as string[]) : new Set(demoState.rsvps);
    rsvps.delete(eventId);
    cookieStore.set(DEMO_RSVPS_COOKIE, JSON.stringify([...rsvps]), { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    demoState.rsvps = rsvps;
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };
  const profile = await getCurrentProfile();
  if (profile?.role !== "student") {
    return { success: false, error: "Only student accounts can manage RSVPs." };
  }

  const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
  if (error) return { success: false, error: friendlyError(error, "Could not cancel RSVP.") };
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true };
}

export async function bookmarkEntity(
  type: "opportunity" | "event" | "club",
  id: string
): Promise<{ success: boolean; error?: string; bookmarked?: boolean }> {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) return { success: false, error: "Please sign in to save." };
    const profile = await getCurrentProfile();
    if (type === "opportunity" && profile?.role !== "student") {
      return { success: false, error: "Only student accounts can save opportunities." };
    }
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_BOOKMARKS_COOKIE)?.value;
    const bookmarks = raw ? new Set(JSON.parse(raw) as string[]) : new Set(demoState.bookmarks);
    const wasBookmarked = bookmarks.has(id);
    if (wasBookmarked) bookmarks.delete(id);
    else bookmarks.add(id);
    cookieStore.set(DEMO_BOOKMARKS_COOKIE, JSON.stringify([...bookmarks]), { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    demoState.bookmarks = bookmarks;
    revalidatePath("/saved");
    revalidatePath("/dashboard");
    return { success: true, bookmarked: !wasBookmarked };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to save." };
  const profile = await getCurrentProfile();
  if (type === "opportunity" && profile?.role !== "student") {
    return { success: false, error: "Only student accounts can save opportunities." };
  }

  const field = type === "opportunity" ? "opportunity_id" : type === "event" ? "event_id" : "club_id";

  const { data: existingRows, error: lookupError } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq(field, id);
  if (lookupError) return { success: false, error: friendlyError(lookupError, "Could not update saved item.") };

  if (existingRows && existingRows.length > 0) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq(field, id);
    if (error) return { success: false, error: friendlyError(error, "Could not remove saved item.") };
    revalidatePath("/saved");
    revalidatePath("/dashboard");
    return { success: true, bookmarked: false };
  }

  const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, [field]: id });
  if (error) return { success: false, error: friendlyError(error) };
  revalidatePath("/saved");
  revalidatePath("/dashboard");
  return { success: true, bookmarked: true };
}

export async function submitFeedback(data: {
  name?: string;
  email?: string;
  category: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();

  const { data: school } = await supabase.from("schools").select("id").eq("slug", "elkhorn-south").maybeSingle();

  const { error } = await supabase.from("feedback").insert({
    school_id: school?.id ?? "a0000000-0000-4000-8000-000000000001",
    user_id: user?.id ?? null,
    name: data.name,
    email: data.email,
    category: data.category,
    message: data.message,
  });
  if (error) return { success: false, error: friendlyError(error) };
  await createAdminAttentionNotification({
    title: "New feedback requires review",
    message: `${data.category}: ${data.message.slice(0, 160)}`,
    link: "/admin/feedback",
    importance: "important",
    type: "system_message",
  });
  return { success: true };
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Feedback updates are unavailable in demo mode." };
  if (!["open", "reviewed", "resolved"].includes(status)) {
    return { success: false, error: "Invalid feedback status." };
  }
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile || !isAdminRole(profile.role)) {
    return { success: false, error: "Administrator access required." };
  }
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) return { success: false, error: friendlyError(error, "Could not update feedback.") };
  revalidatePath("/admin/feedback");
  return { success: true };
}

export async function respondToFeedback(
  id: string,
  response: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Feedback replies are unavailable in demo mode." };
  const trimmed = response.trim();
  if (!trimmed) return { success: false, error: "Response message is required." };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile || !isAdminRole(profile.role)) {
    return { success: false, error: "Administrator access required." };
  }

  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("*, profile:profiles(id,email,full_name)")
    .eq("id", id)
    .maybeSingle();
  if (feedbackError) return { success: false, error: friendlyError(feedbackError, "Could not load feedback.") };
  if (!feedback) return { success: false, error: "Feedback message not found." };

  const recipientEmail = feedback.email || feedback.profile?.email;
  if (!recipientEmail) return { success: false, error: "This feedback message does not have a reply email." };

  await createEmailOutboxItem({
    recipientUserId: feedback.user_id ?? feedback.profile?.id ?? null,
    recipientEmail,
    subject: "[StormHub] Response to your feedback",
    body: `Hi ${feedback.name || feedback.profile?.full_name || "there"},\n\nThanks for contacting StormHub. Here is the response from the admin team:\n\n${trimmed}\n\nOriginal message:\n${feedback.message}\n\nStatus: Resolved`,
    type: "feedback_response",
  });

  if (feedback.user_id) {
    await createNotification({
      recipientUserId: feedback.user_id,
      type: "system_message",
      importance: "important",
      title: "Your feedback was resolved",
      message: trimmed.slice(0, 220),
      link: "/contact",
      sendEmail: false,
    });
  }

  const { error } = await supabase.from("feedback").update({ status: "resolved" }).eq("id", id);
  if (error) return { success: false, error: friendlyError(error, "Could not mark feedback resolved.") };
  revalidatePath("/admin/feedback");
  return { success: true };
}

export async function submitWorkshop(data: {
  title: string;
  description: string;
  subject_area: string;
  skill_level: string;
  starts_at?: string;
  location?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to host a workshop." };
  const profile = await createProfileIfMissing(user.id, user.email ?? "");
  if (!profile || profile.role !== "student") {
    return { success: false, error: "Only student accounts can submit workshops." };
  }
  const { data: school } = await supabase.from("schools").select("id").eq("slug", "elkhorn-south").maybeSingle();

  const { error } = await supabase.from("workshops").insert({
    school_id: school?.id ?? "a0000000-0000-4000-8000-000000000001",
    host_user_id: user.id,
    ...data,
    status: "pending",
  });
  if (error) return { success: false, error: friendlyError(error) };
  await createAdminAttentionNotification({
    title: "Workshop needs review",
    message: `${profile.full_name ?? profile.email ?? "A student"} submitted “${data.title}”.`,
    link: "/manage/approvals",
    importance: "important",
    type: "approval_needed",
  });
  revalidatePath("/workshops");
  revalidatePath("/manage/approvals");
  return { success: true };
}

export async function submitClubProposal(data: {
  name: string;
  shortDescription: string;
  category: string;
  meetingTime?: string;
  meetingLocation?: string;
  sponsorName?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Club proposals are unavailable in demo mode." };
  const supabase = await createClient();
  const admin = createAdminClient();
  const profile = await getCurrentProfile();
  if (!supabase || !admin || !profile) return { success: false, error: "Please sign in." };
  if (profile.role !== "teacher" && !isAdminRole(profile.role)) {
    return { success: false, error: "Only teachers and administrators can propose clubs." };
  }
  const name = data.name.trim();
  if (name.length < 3) return { success: false, error: "Club name is required." };
  const slugBase = slugify(name);
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  const { data: school } = await supabase.from("schools").select("id").eq("slug", "elkhorn-south").maybeSingle();
  const { data: club, error } = await admin.from("clubs").insert({
    school_id: profile.school_id ?? school?.id ?? "a0000000-0000-4000-8000-000000000001",
    name,
    slug,
    short_description: data.shortDescription.trim() || null,
    category: data.category.trim() || "Other",
    meeting_time: data.meetingTime?.trim() || null,
    meeting_location: data.meetingLocation?.trim() || null,
    sponsor_name: data.sponsorName?.trim() || profile.full_name || null,
    sponsor_email: profile.email || null,
    status: "draft",
    visibility: "unlisted",
    is_listed: false,
    is_featured: false,
    is_active: false,
  }).select("id,slug").single();
  if (error) return { success: false, error: friendlyError(error, "Could not submit club proposal.") };

  if (profile.role === "teacher") {
    await admin.from("club_memberships").upsert(
      { club_id: club.id, user_id: profile.id, status: "active", role: "sponsor" },
      { onConflict: "club_id,user_id" }
    );
  }

  await createAdminAttentionNotification({
    title: "Club proposal needs review",
    message: `${profile.full_name ?? profile.email ?? "A teacher"} proposed “${name}”.`,
    link: `/manage/clubs/${club.slug}`,
    importance: "important",
    type: "approval_needed",
  });
  revalidatePath("/manage/clubs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function submitServiceHours(data: {
  title: string;
  organization: string;
  date_completed: string;
  hours: number;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  void data;
  // TODO: Volunteering/service hours disabled because school uses a separate system.
  return { success: false, error: "Service-hour tracking is handled through the school’s separate system." };
}

export async function submitContent(data: {
  type: "announcement" | "event" | "resource" | "opportunity";
  clubSlug?: string;
  title: string;
  body: string;
  starts_at?: string;
  location?: string;
  category?: string;
  deadline?: string;
  event_date?: string;
  external_url?: string;
  action_label?: string;
  resource_url?: string;
  resource_label?: string;
  importance?: NotificationImportance;
  send_email_to_members?: boolean;
  deadline_reminder_enabled?: boolean;
}): Promise<{ success: boolean; error?: string; approved?: boolean }> {
  if (isDemoMode()) return { success: true, approved: false };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };

  const club = data.clubSlug ? await getClubBySlug(data.clubSlug) : null;
  let membership: Pick<ClubMembership, "club_id" | "status" | "role"> | null = null;
  if (data.clubSlug && !club) return { success: false, error: "Club not found." };
  if (club) {
    const { data: membershipData } = await supabase
      .from("club_memberships")
      .select("club_id,status,role")
      .eq("club_id", club.id)
      .eq("user_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    membership = membershipData as Pick<ClubMembership, "club_id" | "status" | "role"> | null;
    if (!canManageClub(profile, club, membership)) {
      return { success: false, error: "You do not have permission to manage this club." };
    }
  } else if (!isAdminRole(profile.role)) {
    return { success: false, error: "Only an administrator can submit school-wide content." };
  }

  const trustedPost =
    isAdminRole(profile.role) ||
    Boolean(club && canManageClub(profile, club, membership)) ||
    (profile.role === "teacher" && membership?.role === "sponsor");
  const contentStatus = trustedPost ? "approved" : "pending";
  const publishedAt = trustedPost ? new Date().toISOString() : null;

  let table: string;
  let insert: Record<string, unknown>;
  if (data.type === "announcement") {
    if (!club) return { success: false, error: "A club is required." };
    table = "club_announcements";
    insert = {
      club_id: club.id,
      author_id: profile.id,
      title: data.title,
      body: data.body,
      visibility: "members",
      status: contentStatus,
      importance: data.importance ?? "normal",
      send_email_to_members: Boolean(data.send_email_to_members),
      published_at: publishedAt,
    };
  } else if (data.type === "event") {
    if (!club) return { success: false, error: "A club is required." };
    if (!data.starts_at) return { success: false, error: "Start date and time are required." };
    table = "events";
    insert = {
      school_id: club.school_id,
      club_id: club.id,
      created_by: profile.id,
      title: data.title,
      description: data.body,
      starts_at: new Date(data.starts_at).toISOString(),
      location: data.location || null,
      visibility: "public",
      status: contentStatus,
      importance: data.importance ?? "normal",
      send_email_to_members: Boolean(data.send_email_to_members),
    };
  } else if (data.type === "resource") {
    if (!club) return { success: false, error: "A club is required." };
    const resourceUrl = data.resource_url?.trim();
    const resourceLabel = data.resource_label?.trim();
    table = "club_resources";
    insert = {
      club_id: club.id,
      author_id: profile.id,
      title: data.title,
      description: data.body,
      resource_type: resourceUrl ? "link" : "text",
      url: resourceUrl || null,
      content: resourceUrl ? resourceLabel || "Open resource" : data.body,
      visibility: "members",
      status: contentStatus,
    };
  } else {
    if (!isAdminRole(profile.role)) {
      return { success: false, error: "Only administrators can publish school-wide opportunities." };
    }
    table = "opportunities";
    insert = {
      school_id: profile.school_id,
      club_id: null,
      author_id: profile.id,
      title: data.title,
      slug: `${slugify(data.title)}-${Date.now().toString(36)}`,
      summary: data.body.slice(0, 240),
      description: data.body,
      category: data.category || "Other",
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      event_date: data.event_date ? new Date(data.event_date).toISOString() : null,
      location: data.location || null,
      external_url: data.external_url || null,
      action_label: data.action_label || "Sign Up",
      visibility: "public",
      status: contentStatus,
      importance: data.importance ?? "normal",
      send_email_to_members: Boolean(data.send_email_to_members),
      deadline_reminder_enabled: Boolean(data.deadline_reminder_enabled),
    };
  }

  if (!insert.school_id && data.type === "opportunity") {
    return { success: false, error: "Your profile is missing a school. Run the Supabase database patch." };
  }

  const contentWriter = trustedPost && club ? (createAdminClient() ?? supabase) : supabase;
  const { data: created, error } = await contentWriter.from(table).insert(insert).select("id").single();
  if (error) return { success: false, error: friendlyError(error, `Could not submit ${data.type}.`) };

  if (!trustedPost && profile.school_id && created?.id) {
    const { error: approvalError } = await supabase.from("approval_requests").insert({
      school_id: profile.school_id,
      content_type: data.type,
      content_id: created.id,
      submitted_by: profile.id,
      status: "pending",
    });
    if (approvalError) console.error("[submitContent approval request]", approvalError.message);
    await createApprovalNeededNotifications({
      schoolId: profile.school_id,
      clubId: club?.id ?? null,
      title: `${data.title} needs approval`,
      message: `${profile.full_name ?? profile.email ?? "A student"} submitted a ${data.type} and is waiting for review.`,
      link: "/manage/approvals",
    });
  } else if (trustedPost && club && created?.id && ["announcement", "event", "resource"].includes(data.type)) {
    await createNotificationsForClubMembers({
      clubId: club.id,
      type:
        data.type === "announcement"
          ? "club_announcement"
          : data.type === "event"
            ? "club_event_created"
            : "system_message",
      importance: data.importance ?? "normal",
      title: data.title,
      message:
        data.type === "announcement"
          ? `A new announcement was posted in ${club.name}.`
          : data.type === "event"
            ? `A new event was added for ${club.name}.`
            : `A new resource was posted in ${club.name}.`,
      link: data.type === "event" ? `/events/${created.id}` : `/clubs/${club.slug}/member`,
      eventId: data.type === "event" ? created.id : null,
      sendEmail: Boolean(data.send_email_to_members),
    });
  }

  revalidatePath("/manage/approvals");
  if (club) {
    revalidatePath(`/clubs/${club.slug}`);
    revalidatePath(`/clubs/${club.slug}/member`);
  }
  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/opportunities");
  return { success: true, approved: trustedPost };
}

export async function updateUserRoleAndClubs(data: {
  targetUserId: string;
  role: UserRole;
  clubIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Role editing is unavailable in demo mode." };
  const supabase = await createClient();
  const actor = await getCurrentProfile();
  if (!supabase || !actor) return { success: false, error: "Please sign in." };

  const { data: targetData, error: targetError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.targetUserId)
    .maybeSingle();
  if (targetError || !targetData) return { success: false, error: "User not found." };
  const target = targetData as Profile;
  if (!canEditRole(actor, target, data.role)) {
    return { success: false, error: "You do not have permission to make this role change." };
  }
  if (data.role === "teacher" && data.clubIds.length === 0) {
    return { success: false, error: "Choose at least one club for the teacher." };
  }

  const { error } = await supabase.rpc("admin_set_user_role_and_clubs", {
    target_user_id: data.targetUserId,
    new_role: data.role,
    assigned_club_ids: data.role === "teacher" ? data.clubIds : [],
  });
  if (error) return { success: false, error: friendlyError(error, "Could not update this user.") };

  revalidatePath("/admin/users");
  revalidatePath("/manage/clubs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteUserAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "User deletion is unavailable in demo mode." };
  const supabase = await createClient();
  const admin = createAdminClient();
  const actor = await getCurrentProfile();
  if (!supabase || !admin || !actor) {
    return { success: false, error: "Administrator configuration is incomplete. Check SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data: targetData, error: targetError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetError || !targetData) return { success: false, error: "User not found." };

  const target = targetData as Profile;
  if (!canDeleteUser(actor, target)) {
    return { success: false, error: "You do not have permission to delete this account." };
  }

  const cleanupSteps = [
    admin.from("opportunities").update({ author_id: null }).eq("author_id", targetUserId),
    admin.from("events").update({ created_by: null }).eq("created_by", targetUserId),
    admin.from("workshops").update({ host_user_id: null }).eq("host_user_id", targetUserId),
    admin.from("service_hours").update({ approved_by: null }).eq("approved_by", targetUserId),
    admin.from("approval_requests").update({ reviewed_by: null }).eq("reviewed_by", targetUserId),
    admin.from("analytics_events").update({ user_id: null }).eq("user_id", targetUserId),
    admin.from("feedback").update({ user_id: null }).eq("user_id", targetUserId),
    admin.from("approval_requests").delete().eq("submitted_by", targetUserId),
  ];

  const cleanupResults = await Promise.all(cleanupSteps);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) {
    return { success: false, error: friendlyError(cleanupError, "Could not clean up user references.") };
  }

  const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
  if (authError) {
    return { success: false, error: authError.message || "Could not delete the authentication account." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/manage/clubs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateClubMember(data: {
  clubId: string;
  userId: string;
  role?: MembershipRole;
  remove?: boolean;
  ban?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Roster editing is unavailable in demo mode." };
  const supabase = await createClient();
  const actor = await getCurrentProfile();
  if (!supabase || !actor) return { success: false, error: "Please sign in." };

  const { data: club } = await supabase.from("clubs").select("*").eq("id", data.clubId).maybeSingle();
  if (!club) return { success: false, error: "Club not found." };
  const { data: actorMembership } = await supabase
    .from("club_memberships")
    .select("club_id,status,role")
    .eq("club_id", data.clubId)
    .eq("user_id", actor.id)
    .eq("status", "active")
    .maybeSingle();
  if (!canManageClubRoster(actor, club, actorMembership)) {
    return { success: false, error: "Only an assigned teacher or administrator can manage this roster." };
  }
  if (data.userId === actor.id) {
    return { success: false, error: "You cannot change your own roster assignment here." };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", data.userId)
    .maybeSingle();
  const targetName = targetProfile?.full_name ?? targetProfile?.email ?? "A club member";
  const nextRole = data.remove || data.ban ? "member" : (data.role ?? "member");

  const { error } = data.ban
    ? await supabase
        .from("club_memberships")
        .update({ status: "rejected", role: "member" })
        .eq("club_id", data.clubId)
        .eq("user_id", data.userId)
    : await supabase.rpc("manage_club_roster_member", {
        target_club_id: data.clubId,
        target_user_id: data.userId,
        new_membership_role: nextRole,
        remove_member: !!data.remove,
      });
  if (error) return { success: false, error: friendlyError(error, "Could not update the roster.") };

  if (data.ban) {
    await createNotification({
      recipientUserId: data.userId,
      type: "system_message",
      importance: "urgent",
      title: `Blocked from ${club.name}`,
      message: `A teacher or administrator blocked you from rejoining ${club.name}. Contact the club sponsor if this seems incorrect.`,
      link: `/clubs/${club.slug}`,
      clubId: club.id,
      sendEmail: true,
    });
  } else if (data.remove) {
    await createNotification({
      recipientUserId: data.userId,
      type: "system_message",
      importance: "important",
      title: `Removed from ${club.name}`,
      message: `You were removed from the ${club.name} roster.`,
      link: `/clubs/${club.slug}`,
      clubId: club.id,
    });
  } else {
    const isLeadershipRole = nextRole === "officer" || nextRole === "president";
    await createNotification({
      recipientUserId: data.userId,
      type: "system_message",
      importance: isLeadershipRole ? "important" : "normal",
      title: `Club role updated: ${club.name}`,
      message: `Your role in ${club.name} is now ${formatMembershipRole(nextRole)}.`,
      link: `/clubs/${club.slug}/member`,
      clubId: club.id,
      sendEmail: isLeadershipRole,
    });
    await createNotificationsForClubSponsors({
      clubId: club.id,
      title: `Roster role changed: ${targetName}`,
      message: `${targetName}'s role in ${club.name} is now ${formatMembershipRole(nextRole)}.`,
      link: `/manage/clubs/${club.slug}/members`,
      excludeUserIds: [actor.id],
    });
  }

  revalidatePath(`/manage/clubs/${club.slug}/members`);
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateClubSettings(data: {
  clubId: string;
  name: string;
  shortDescription: string;
  meetingTime: string;
  meetingLocation: string;
  sponsorName: string;
  status: "draft" | "interest_open" | "active" | "paused" | "archived";
  visibility: "public" | "unlisted" | "private";
  isListed: boolean;
  isFeatured: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Club editing is unavailable in demo mode." };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const { data: club } = await supabase.from("clubs").select("*").eq("id", data.clubId).maybeSingle();
  if (!club) return { success: false, error: "Club not found." };
  const { data: membership } = await supabase
    .from("club_memberships")
    .select("club_id,status,role")
    .eq("club_id", data.clubId)
    .eq("user_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  if (!canManageClub(profile, club, membership)) {
    return { success: false, error: "You do not have permission to edit this club." };
  }

  const { error } = await supabase.from("clubs").update({
    name: data.name,
    short_description: data.shortDescription,
    meeting_time: data.meetingTime || null,
    meeting_location: data.meetingLocation || null,
    sponsor_name: data.sponsorName || null,
    status: data.status,
    visibility: data.visibility,
    is_listed: data.isListed,
    is_featured: data.isFeatured,
    is_active: ["interest_open", "active"].includes(data.status),
  }).eq("id", data.clubId);
  if (error) return { success: false, error: friendlyError(error, "Could not update the club.") };

  revalidatePath(`/manage/clubs/${club.slug}`);
  revalidatePath(`/manage/clubs/${club.slug}/edit`);
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  return { success: true };
}

export async function deleteServiceHour(id: string): Promise<{ success: boolean; error?: string }> {
  void id;
  // TODO: Volunteering/service hours disabled because school uses a separate system.
  return { success: false, error: "Service-hour tracking is handled through the school’s separate system." };
}

export async function demoSignIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (!isDemoMode()) {
    return supabaseSignIn(email, password);
  }
  if (!email || !password) return { success: false, error: "Email and password required." };
  const cookieStore = await cookies();
  cookieStore.set(DEMO_USER_COOKIE, `demo-${email}`, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
  cookieStore.set(DEMO_EMAIL_COOKIE, email, { httpOnly: false, path: "/", maxAge: 60 * 60 * 24 * 7 });
  return { success: true };
}

export async function demoSignOut(): Promise<void> {
  if (!isDemoMode()) {
    await supabaseSignOut();
    return;
  }
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_USER_COOKIE);
  cookieStore.delete(DEMO_EMAIL_COOKIE);
}

export async function supabaseSignIn(email: string, password: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: friendlyError(error, "Sign in failed.") };
  if (data.user) {
    await createProfileIfMissing(data.user.id, data.user.email ?? "", data.user.user_metadata?.full_name as string);
  }
  return { success: true };
}

export async function supabaseSignUp(email: string, password: string, fullName: string, gradeLevel?: number | null, accessCode?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
  const requiredAccessCode = process.env.SIGNUP_ACCESS_CODE?.trim();
  if (normalizedFullName.length < 3 || normalizedFullName.length > 120) {
    return { success: false, error: "Enter your full name." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }
  if (requiredAccessCode && accessCode?.trim() !== requiredAccessCode) {
    return { success: false, error: "Enter the correct school signup code." };
  }
  const normalizedGrade = typeof gradeLevel === "number" && gradeLevel >= 6 && gradeLevel <= 12
    ? gradeLevel
    : null;
  const allowedDomains = (process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const blockedDomains = (process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const emailDomain = normalizedEmail.split("@")[1]?.toLowerCase();
  if (allowedDomains.length > 0 && (!emailDomain || !allowedDomains.includes(emailDomain))) {
    return {
      success: false,
      error: `Please use an approved school email address (${allowedDomains.join(", ")}).`,
    };
  }
  if (emailDomain && blockedDomains.includes(emailDomain)) {
    return { success: false, error: "Please use a school email address." };
  }
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { full_name: normalizedFullName, grade_level: normalizedGrade } },
  });
  if (error) return { success: false, error: friendlyError(error, "Sign up failed.") };
  if (data.user) {
    await createProfileIfMissing(data.user.id, normalizedEmail, normalizedFullName);
    await supabase
      .from("profiles")
      .update({ full_name: normalizedFullName, grade_level: normalizedGrade })
      .eq("id", data.user.id);
  }
  return { success: true, needsConfirmation: !data.session };
}

export async function updateProfileSettings(data: {
  fullName: string;
  gradeLevel?: number | null;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Profile editing is unavailable in demo mode." };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const fullName = data.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 3 || fullName.length > 120) return { success: false, error: "Enter your full name." };
  const gradeLevel = typeof data.gradeLevel === "number" && data.gradeLevel >= 6 && data.gradeLevel <= 12
    ? data.gradeLevel
    : null;
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, grade_level: gradeLevel })
    .eq("id", profile.id);
  if (error) return { success: false, error: friendlyError(error, "Could not update profile.") };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function supabaseSignOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
}

export async function checkMembership(slug: string): Promise<boolean> {
  if (isDemoMode()) {
    const memberships = await getDemoMemberships();
    return memberships.has(slug);
  }

  const supabase = await createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const club = await getClubBySlug(slug);
  if (!club) return false;

  const { data } = await supabase
    .from("club_memberships")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return !!data;
}

export async function getUserBookmarkIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_BOOKMARKS_COOKIE)?.value;
    try {
      return raw ? new Set(JSON.parse(raw) as string[]) : demoState.bookmarks;
    } catch {
      return demoState.bookmarks;
    }
  }
  const supabase = await createClient();
  if (!supabase) return new Set();
  const { data } = await supabase.from("bookmarks").select("opportunity_id").eq("user_id", userId);
  return new Set((data ?? []).map((b) => b.opportunity_id).filter(Boolean) as string[]);
}

export async function getUserRsvpIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_RSVPS_COOKIE)?.value;
    try {
      return raw ? new Set(JSON.parse(raw) as string[]) : demoState.rsvps;
    } catch {
      return demoState.rsvps;
    }
  }
  const supabase = await createClient();
  if (!supabase) return new Set();
  const { data } = await supabase
    .from("event_rsvps")
    .select("event_id")
    .eq("user_id", userId)
    .in("status", ["going", "interested"]);
  return new Set((data ?? []).map((r) => r.event_id).filter(Boolean) as string[]);
}

const APPROVAL_TABLES: Record<ApprovalContentType, string> = {
  announcement: "club_announcements",
  event: "events",
  resource: "club_resources",
  opportunity: "opportunities",
  workshop: "workshops",
};

const CLUB_CONTENT_TABLES: Record<"announcement" | "event" | "resource", string> = {
  announcement: "club_announcements",
  event: "events",
  resource: "club_resources",
};

export async function archiveClubContent(
  id: string,
  contentType: "announcement" | "event" | "resource"
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Content deletion is unavailable in demo mode." };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const table = CLUB_CONTENT_TABLES[contentType];
  if (!table) return { success: false, error: "Unknown content type." };

  const { data: content } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (!content?.club_id) return { success: false, error: "Content not found." };
  const { data: club } = await supabase.from("clubs").select("*").eq("id", content.club_id).maybeSingle();
  if (!club) return { success: false, error: "Club not found." };
  const { data: membership } = await supabase
    .from("club_memberships")
    .select("club_id,status,role")
    .eq("club_id", club.id)
    .eq("user_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  if (!canApproveClubContent(profile, club, membership)) {
    return { success: false, error: "Only the teacher sponsor or an admin can delete club content." };
  }

  const { error } = await supabase.from(table).update({ status: "archived" }).eq("id", id);
  if (error) return { success: false, error: friendlyError(error, "Could not delete content.") };

  if (content.author_id && content.author_id !== profile.id) {
    await createNotification({
      recipientUserId: content.author_id,
      type: "system_message",
      importance: "important",
      title: `${content.title ?? "Content"} was removed`,
      message: `A teacher sponsor or admin removed your ${contentType}.`,
      link: `/clubs/${club.slug}/member`,
      clubId: club.id,
      eventId: contentType === "event" ? id : null,
    });
  }

  revalidatePath(`/manage/clubs/${club.slug}`);
  revalidatePath(`/manage/clubs/${club.slug}/${contentType === "announcement" ? "announcements" : `${contentType}s`}`);
  revalidatePath(`/clubs/${club.slug}/member`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function approveContent(
  id: string,
  contentType: ApprovalContentType
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "Approval actions are unavailable in demo mode." };
  }
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const profile = await getCurrentProfile();
  if (!profile || !canApproveContent(profile)) {
    return { success: false, error: "You do not have permission to approve this item." };
  }

  const table = APPROVAL_TABLES[contentType];
  if (!table) return { success: false, error: "Unknown content type." };

  const { data: content } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  const { data: approval } = await supabase
    .from("approval_requests")
    .select("submitted_by")
    .eq("content_id", id)
    .eq("status", "pending")
    .maybeSingle();
  const updatePayload: Record<string, unknown> = { status: "approved" };
  if (contentType === "announcement") updatePayload.published_at = new Date().toISOString();
  const { error } = await supabase.from(table).update(updatePayload).eq("id", id);
  if (error) return { success: false, error: friendlyError(error) };
  await supabase
    .from("approval_requests")
    .update({ status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("content_id", id)
    .eq("status", "pending");
  const contentRecord = (content as Record<string, unknown> | null) ?? null;
  const { data: contentClub } = content?.club_id
    ? await supabase.from("clubs").select("name,slug").eq("id", content.club_id).maybeSingle()
    : { data: null };
  const submitterLink = contentReviewLink(contentType, contentRecord, contentClub);

  if (approval?.submitted_by) {
    await createNotification({
      recipientUserId: approval.submitted_by,
      type: "content_approved",
      importance: "normal",
      title: `${content?.title ?? "Content"} approved`,
      message: `Your ${contentType.replace("_", " ")} was approved.`,
      link: submitterLink,
      clubId: content?.club_id ?? null,
      eventId: contentType === "event" ? id : null,
    });
  }
  if (content?.club_id && ["announcement", "event"].includes(contentType)) {
    const club = contentClub;
    if (club) {
      await createNotificationsForClubMembers({
        clubId: content.club_id,
        type: contentType === "announcement" ? "club_announcement" : "club_event_created",
        importance: content.importance ?? "normal",
        title: content.title,
        message:
          contentType === "announcement"
            ? `A new announcement was posted in ${club.name}.`
            : `A new event was added for ${club.name}.`,
        link: contentType === "announcement" ? `/clubs/${club.slug}/member` : `/events/${id}`,
        eventId: contentType === "event" ? id : null,
        sendEmail: Boolean(content.send_email_to_members),
      });
    }
  }
  revalidatePath("/manage/approvals");
  revalidatePath("/events");
  revalidatePath("/opportunities");
  return { success: true };
}

export async function rejectContent(
  id: string,
  contentType: ApprovalContentType,
  reviewerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "Approval actions are unavailable in demo mode." };
  }
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const profile = await getCurrentProfile();
  if (!profile || !canApproveContent(profile)) {
    return { success: false, error: "You do not have permission to reject this item." };
  }

  const table = APPROVAL_TABLES[contentType];
  if (!table) return { success: false, error: "Unknown content type." };

  const { data: content } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  const { data: approval } = await supabase
    .from("approval_requests")
    .select("submitted_by")
    .eq("content_id", id)
    .eq("status", "pending")
    .maybeSingle();
  const { error } = await supabase.from(table).update({ status: "rejected" }).eq("id", id);
  if (error) return { success: false, error: friendlyError(error) };
  await supabase
    .from("approval_requests")
    .update({
      status: "rejected",
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
    })
    .eq("content_id", id)
    .eq("status", "pending");
  const contentRecord = (content as Record<string, unknown> | null) ?? null;
  const { data: contentClub } = content?.club_id
    ? await supabase.from("clubs").select("slug").eq("id", content.club_id).maybeSingle()
    : { data: null };

  if (approval?.submitted_by) {
    await createNotification({
      recipientUserId: approval.submitted_by,
      type: "content_rejected",
      importance: "important",
      title: `${content?.title ?? "Content"} needs changes`,
      message: reviewerNotes || `Your ${contentType.replace("_", " ")} was rejected.`,
      link: contentReviewLink(contentType, contentRecord, contentClub),
      clubId: content?.club_id ?? null,
      eventId: contentType === "event" ? id : null,
      sendEmail: true,
    });
  }
  revalidatePath("/manage/approvals");
  return { success: true };
}

export async function markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const store = await cookies();
    const read = new Set<string>(JSON.parse(store.get(DEMO_READ_NOTIFICATIONS_COOKIE)?.value ?? "[]"));
    read.add(id);
    store.set(DEMO_READ_NOTIFICATIONS_COOKIE, JSON.stringify([...read]), { httpOnly: true, path: "/" });
    revalidatePath("/notifications");
    return { success: true };
  }
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_user_id", profile.id);
  if (error) return { success: false, error: friendlyError(error) };
  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const store = await cookies();
    store.set(DEMO_READ_NOTIFICATIONS_COOKIE, JSON.stringify(["demo-notification-1", "demo-notification-2"]), { httpOnly: true, path: "/" });
    revalidatePath("/notifications");
    return { success: true };
  }
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", profile.id)
    .is("read_at", null);
  if (error) return { success: false, error: friendlyError(error) };
  revalidatePath("/notifications");
  return { success: true };
}

export async function updateNotificationPreferences(
  preferences: Omit<NotificationPreferences, "id" | "user_id" | "created_at" | "updated_at">
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: profile.id,
    ...preferences,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return { success: false, error: friendlyError(error) };
  revalidatePath("/settings");
  return { success: true };
}

export async function generateOpportunityDeadlineReminders(): Promise<{ success: boolean; count?: number; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminRole(profile.role)) return { success: false, error: "Administrator access required." };
  const count = await createOpportunityDeadlineReminders();
  revalidatePath("/notifications");
  return { success: true, count };
}

export async function retryEmailOutbox(): Promise<{ success: boolean; attempted?: number; sent?: number; failed?: number; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminRole(profile.role)) return { success: false, error: "Administrator access required." };
  const result = await processEmailOutbox();
  revalidatePath("/manage/email-outbox");
  return { success: true, ...result };
}
