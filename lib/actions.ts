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
} from "@/types/database";
import { slugify } from "@/lib/utils";
import {
  createAdminAttentionNotification,
  createEventRsvpNotifications,
  createNotification,
  createNotificationsForClubMembers,
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

  const { error } = await supabase.from("club_memberships").upsert(
    { club_id: club.id, user_id: user.id, status: "active", role: "member" },
    { onConflict: "club_id,user_id" }
  );

  if (error) return { success: false, error: friendlyError(error, "Could not join club.") };

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
    revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
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
    link: "/admin",
    importance: "important",
    type: "system_message",
  });
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
  const { data: school } = await supabase.from("schools").select("id").eq("slug", "elkhorn-south").maybeSingle();

  const { error } = await supabase.from("workshops").insert({
    school_id: school?.id ?? "a0000000-0000-4000-8000-000000000001",
    host_user_id: user?.id,
    ...data,
    status: "pending",
  });
  if (error) return { success: false, error: friendlyError(error) };
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
    (profile.role === "teacher" && membership?.role === "sponsor");
  const contentStatus = trustedPost ? "approved" : "pending";

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
    table = "club_resources";
    insert = {
      club_id: club.id,
      author_id: profile.id,
      title: data.title,
      description: data.body,
      resource_type: "text",
      content: data.body,
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

  const { data: created, error } = await supabase.from(table).insert(insert).select("id").single();
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
    await createAdminAttentionNotification({
      title: `${data.title} needs approval`,
      message: `A ${data.type} was submitted and is waiting for review.`,
      link: "/manage/approvals",
      importance: "important",
      type: "approval_needed",
    });
  } else if (trustedPost && club && created?.id && ["announcement", "event"].includes(data.type)) {
    await createNotificationsForClubMembers({
      clubId: club.id,
      type: data.type === "announcement" ? "club_announcement" : "club_event_created",
      importance: data.importance ?? "normal",
      title: data.title,
      message:
        data.type === "announcement"
          ? `A new announcement was posted in ${club.name}.`
          : `A new event was added for ${club.name}.`,
      link: data.type === "announcement" ? `/clubs/${club.slug}/member` : `/events/${created.id}`,
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

  const { error } = await supabase.rpc("manage_club_roster_member", {
    target_club_id: data.clubId,
    target_user_id: data.userId,
    new_membership_role: data.remove ? "member" : (data.role ?? "member"),
    remove_member: !!data.remove,
  });
  if (error) return { success: false, error: friendlyError(error, "Could not update the roster.") };

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

export async function supabaseSignUp(email: string, password: string, fullName: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { success: false, error: friendlyError(error, "Sign up failed.") };
  if (data.user) {
    await createProfileIfMissing(data.user.id, email, fullName);
  }
  return { success: true, needsConfirmation: !data.session };
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
  const { data } = await supabase.from("event_rsvps").select("event_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.event_id).filter(Boolean) as string[]);
}

const APPROVAL_TABLES: Record<ApprovalContentType, string> = {
  announcement: "club_announcements",
  event: "events",
  resource: "club_resources",
  opportunity: "opportunities",
  workshop: "workshops",
};

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
  const { error } = await supabase.from(table).update({ status: "approved" }).eq("id", id);
  if (error) return { success: false, error: friendlyError(error) };
  await supabase
    .from("approval_requests")
    .update({ status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("content_id", id)
    .eq("status", "pending");
  if (approval?.submitted_by) {
    await createNotification({
      recipientUserId: approval.submitted_by,
      type: "content_approved",
      importance: "normal",
      title: `${content?.title ?? "Content"} approved`,
      message: `Your ${contentType.replace("_", " ")} was approved.`,
      link: "/manage/approvals",
    });
  }
  if (content?.club_id && ["announcement", "event"].includes(contentType)) {
    const { data: club } = await supabase.from("clubs").select("name,slug").eq("id", content.club_id).maybeSingle();
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

  const { data: content } = await supabase.from(table).select("title").eq("id", id).maybeSingle();
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
  if (approval?.submitted_by) {
    await createNotification({
      recipientUserId: approval.submitted_by,
      type: "content_rejected",
      importance: "important",
      title: `${content?.title ?? "Content"} needs changes`,
      message: reviewerNotes || `Your ${contentType.replace("_", " ")} was rejected.`,
      link: "/manage/approvals",
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
