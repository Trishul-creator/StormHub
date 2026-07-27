"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import { createProfileIfMissing, defaultPathForProfile, getAuthUserId, getCurrentProfile } from "@/lib/auth";
import { demoState } from "@/lib/data/demo-data";
import { getClubBySlug, getManagedClubBySlug } from "@/lib/data";
import { friendlyAuthEmailError, friendlyError } from "@/lib/errors";
import {
  canApproveContent,
  canApproveClubContent,
  canDeleteUser,
  canEditRole,
  canManageClub,
  canManageClubPublication,
  canManageClubCoursework,
  canManageClubRoster,
  isAdminRole,
} from "@/lib/permissions";
import type {
  ApprovalContentType,
  Club,
  ClubMembership,
  MembershipRole,
  Profile,
  UserRole,
  AccountStatus,
  AssignmentStatus,
  ClubAssignment,
  ClubAssignmentSubmission,
  FeedbackStatus,
} from "@/types/database";
import { slugify } from "@/lib/utils";
import { DEFAULT_SCHOOL_ID, SUPPORT_EMAIL, getCurrentSchool, getSchoolById } from "@/lib/schools";
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
import {
  getClientAddress,
  getAllowedSignupDomains,
  getSignupRateLimitConfig,
  hashSignupIdentifier,
  isMissingAllowedEmailDomainsColumn,
  parseSignupDomainInput,
  validateSignupEmailDomain,
  type SignupBotProof,
  validateSignupBotProof,
} from "@/lib/signup-security";
import { verifyCaptchaToken } from "@/lib/captcha";
import { checkDurableRateLimit, markRateLimitAttemptSuccessful } from "@/lib/request-rate-limit";
import { getAuthCallbackUrl } from "@/lib/env";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import {
  copyGoogleDriveFileForStudent,
  disconnectGoogleDrive,
  ensureGoogleDrivePermission,
  getGoogleDriveConnectionStatus,
  getGoogleDriveFile,
  isCopyableGoogleWorkspaceFile,
  isGoogleDriveReconnectError,
  isGoogleWorkspaceFile,
} from "@/lib/google-drive";

const DEMO_USER_COOKIE = "stormhub_demo_user";
const DEMO_EMAIL_COOKIE = "stormhub_demo_email";
const DEMO_MEMBERSHIPS_COOKIE = "stormhub_demo_memberships";
const DEMO_BOOKMARKS_COOKIE = "stormhub_demo_bookmarks";
const DEMO_RSVPS_COOKIE = "stormhub_demo_rsvps";
const DEMO_OPPORTUNITY_SIGNUPS_COOKIE = "stormhub_demo_opportunity_signups";
const DEMO_READ_NOTIFICATIONS_COOKIE = "stormhub_demo_read_notifications";

function formatMembershipRole(role: MembershipRole): string {
  return role.replace(/_/g, " ");
}

function userRoleRank(role: UserRole): number {
  return { student: 1, teacher: 2, admin: 3, super_admin: 4 }[role];
}

function membershipRoleRank(role: MembershipRole): number {
  return { member: 1, officer: 2, president: 3, sponsor: 4 }[role];
}

function contentReviewLink(contentType: ApprovalContentType, content: Record<string, unknown> | null, club?: { slug: string } | null): string {
  if (contentType === "event" && typeof content?.id === "string") return `/events/${content.id}`;
  if (contentType === "opportunity" && typeof content?.slug === "string") return `/opportunities/${content.slug}`;
  if (club?.slug) return `/clubs/${club.slug}/member`;
  if (contentType === "workshop") return "/opportunities";
  return "/dashboard";
}

async function notifySchoolStudentsAboutPublishedClub(input: { club: Club }) {
  const admin = createAdminClient();
  if (!admin) return;

  const [school, { data: students, error }] = await Promise.all([
    getSchoolById(input.club.school_id),
    admin
      .from("profiles")
      .select("id,email,full_name")
      .eq("school_id", input.club.school_id)
      .eq("role", "student")
      .not("email", "is", null),
  ]);

  if (error) {
    console.error("[notifySchoolStudentsAboutPublishedClub]", error.message);
    return;
  }

  const schoolName = school?.short_name || school?.name || "your school";
  const schoolSlug = school?.slug;
  const relativeLink = schoolSlug ? `/s/${schoolSlug}/clubs/${input.club.slug}` : `/clubs/${input.club.slug}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "") || "";
  const absoluteLink = baseUrl ? `${baseUrl}${relativeLink}` : relativeLink;
  const description = input.club.short_description || input.club.long_description || "A new club is now available on StormHub.";
  const details = [
    input.club.category ? `Category: ${input.club.category}` : null,
  ].filter(Boolean).join("\n");
  const joinText = input.club.join_instructions || "Open StormHub to view the club and join or request updates.";
  const title = `New club at ${schoolName}: ${input.club.name}`;
  const message = `${input.club.name} is now open on StormHub. ${description}`;
  const emailBody = [
    `A new club just opened at ${schoolName}: ${input.club.name}.`,
    description,
    details,
    joinText,
    `Open in StormHub: ${absoluteLink}`,
  ].filter(Boolean).join("\n\n");

  await Promise.all(
    ((students ?? []) as Array<{ id: string; email: string | null }>).map(async (student) => {
      await createNotification({
        recipientUserId: student.id,
        type: "system_message",
        importance: "important",
        title,
        message,
        link: relativeLink,
        clubId: input.club.id,
      });
      if (student.email) {
        await createEmailOutboxItem({
          recipientUserId: student.id,
          recipientEmail: student.email,
          subject: `[StormHub] ${input.club.name} is now open`,
          body: emailBody,
          type: "club_published",
        });
      }
    })
  );
}

async function getValidTeacherSponsor(input: {
  sponsorUserId?: string | null;
  schoolId: string;
}): Promise<{ id: string; full_name: string | null; email: string | null } | null> {
  const sponsorUserId = input.sponsorUserId?.trim();
  if (!sponsorUserId) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id,full_name,email,school_id,role")
    .eq("id", sponsorUserId)
    .eq("school_id", input.schoolId)
    .eq("role", "teacher")
    .maybeSingle();
  if (error) {
    console.error("[getValidTeacherSponsor]", error.message);
    return null;
  }
  return data as { id: string; full_name: string | null; email: string | null } | null;
}

async function syncClubSponsorMembership(input: {
  clubId: string;
  sponsorUserId?: string | null;
  schoolId: string;
}) {
  const admin = createAdminClient();
  if (!admin) return null;
  const sponsor = await getValidTeacherSponsor({
    sponsorUserId: input.sponsorUserId,
    schoolId: input.schoolId,
  });

  await admin
    .from("club_memberships")
    .update({ status: "left", role: "member" })
    .eq("club_id", input.clubId)
    .eq("role", "sponsor");

  if (!sponsor) return null;

  const { error } = await admin.from("club_memberships").upsert(
    {
      club_id: input.clubId,
      user_id: sponsor.id,
      status: "active",
      role: "sponsor",
    },
    { onConflict: "club_id,user_id" }
  );
  if (error) {
    console.error("[syncClubSponsorMembership]", error.message);
    return null;
  }

  return sponsor;
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

  const club = await getClubBySlug(clubSlug, profile.school_id);
  if (!club) return { success: false, error: "Club not found." };
  if (!profile.school_id || profile.school_id !== club.school_id) {
    return { success: false, error: "You can only join clubs in your own school." };
  }
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

  const { data: event } = await supabase
    .from("events")
    .select("id, school_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.school_id !== profile.school_id) {
    return { success: false, error: "You can only RSVP to events in your own school." };
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
  const { data: event } = await supabase
    .from("events")
    .select("id, school_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.school_id !== profile.school_id) {
    return { success: false, error: "You can only manage RSVPs in your own school." };
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
  if (!profile?.school_id) {
    return { success: false, error: "Your account is not assigned to a school." };
  }

  const table = type === "opportunity" ? "opportunities" : type === "event" ? "events" : "clubs";
  const { data: targetItem, error: targetError } = await supabase
    .from(table)
    .select("id, school_id")
    .eq("id", id)
    .maybeSingle();
  if (targetError || !targetItem || targetItem.school_id !== profile.school_id) {
    return { success: false, error: "You can only save items from your own school." };
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

export async function registerForOpportunity(
  opportunityId: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    const profile = await getCurrentProfile();
    if (!userId) return { success: false, error: "Please sign in to participate." };
    if (profile?.role !== "student") {
      return { success: false, error: "Only student accounts can participate in opportunities." };
    }
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_OPPORTUNITY_SIGNUPS_COOKIE)?.value;
    const signups = raw
      ? new Set(JSON.parse(raw) as string[])
      : new Set(demoState.opportunitySignups);
    signups.add(opportunityId);
    cookieStore.set(DEMO_OPPORTUNITY_SIGNUPS_COOKIE, JSON.stringify([...signups]), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    demoState.opportunitySignups = signups;
    revalidatePath("/opportunities");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to participate." };
  const profile = await createProfileIfMissing(user.id, user.email ?? "");
  if (!profile || profile.role !== "student") {
    return { success: false, error: "Only student accounts can participate in opportunities." };
  }

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,slug,school_id,status,visibility")
    .eq("id", opportunityId)
    .maybeSingle();
  if (
    opportunityError
    || !opportunity
    || opportunity.school_id !== profile.school_id
    || opportunity.status !== "approved"
    || opportunity.visibility !== "public"
  ) {
    return { success: false, error: "This opportunity is not available for your account." };
  }

  const { error } = await supabase.from("opportunity_signups").upsert(
    {
      opportunity_id: opportunityId,
      user_id: user.id,
      status: "registered",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "opportunity_id,user_id" }
  );
  if (error) {
    if (error.code === "42P01") {
      return { success: false, error: "Apply the latest database migration before using opportunity sign-ups." };
    }
    return { success: false, error: friendlyError(error, "Could not complete this sign-up.") };
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunity.slug}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function cancelOpportunitySignup(
  opportunityId: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_OPPORTUNITY_SIGNUPS_COOKIE)?.value;
    const signups = raw
      ? new Set(JSON.parse(raw) as string[])
      : new Set(demoState.opportunitySignups);
    signups.delete(opportunityId);
    cookieStore.set(DEMO_OPPORTUNITY_SIGNUPS_COOKIE, JSON.stringify([...signups]), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    demoState.opportunitySignups = signups;
    revalidatePath("/opportunities");
    return { success: true };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in." };
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("slug")
    .eq("id", opportunityId)
    .maybeSingle();
  const { error } = await supabase
    .from("opportunity_signups")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("user_id", user.id);
  if (error) return { success: false, error: friendlyError(error, "Could not withdraw this sign-up.") };

  revalidatePath("/opportunities");
  if (opportunity?.slug) revalidatePath(`/opportunities/${opportunity.slug}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function submitFeedback(data: {
  name?: string;
  email?: string;
  category: string;
  message: string;
  captchaToken?: string | null;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  if (isDemoMode()) return { success: true };

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { success: false, error: "Support is not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getCurrentProfile() : null;
  const school = profile?.school_id ? await getSchoolById(profile.school_id) : await getCurrentSchool();
  if (!school) return { success: false, error: "Choose a school workspace before contacting support." };

  const name = data.name?.trim().replace(/\s+/g, " ") || null;
  const email = data.email?.trim().toLowerCase() || user?.email || null;
  const message = data.message.trim();
  const normalizedCategory = data.category.trim().toLowerCase();
  const allowedCategories = new Set(["app-feedback", "bug", "feature", "club", "other"]);
  if (!allowedCategories.has(normalizedCategory)) {
    return { success: false, error: "Choose a valid support category." };
  }
  if (name && name.length > 120) return { success: false, error: "Name is too long." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Enter a valid reply email." };
  }
  if (message.length < 10 || message.length > 5000) {
    return { success: false, error: "Enter a message between 10 and 5,000 characters." };
  }

  const requestHeaders = await headers();
  const clientAddress = getClientAddress(requestHeaders) ?? "unknown";
  const captcha = await verifyCaptchaToken(data.captchaToken, clientAddress);
  if (!captcha.success) return captcha;

  const ipLimit = await checkDurableRateLimit({
    requestType: "feedback-ip",
    identity: clientAddress,
    maxAttempts: 10,
    windowMinutes: 60,
  });
  if (!ipLimit.allowed) return { success: false, error: ipLimit.error };
  const senderLimit = await checkDurableRateLimit({
    requestType: "feedback-sender",
    identity: email || clientAddress,
    maxAttempts: 5,
    windowMinutes: 60,
  });
  if (!senderLimit.allowed) return { success: false, error: senderLimit.error };

  const { error: insertError } = await admin.from("feedback").insert({
    school_id: school.id,
    user_id: user?.id ?? null,
    name,
    email,
    category: normalizedCategory,
    message,
    status: "open",
  });
  if (insertError) return { success: false, error: friendlyError(insertError, "Could not save your support message.") };
  await Promise.all([
    markRateLimitAttemptSuccessful(ipLimit.attemptId),
    markRateLimitAttemptSuccessful(senderLimit.attemptId),
  ]);

  await createEmailOutboxItem({
    recipientEmail: SUPPORT_EMAIL,
    subject: `[StormHub Support] ${
      normalizedCategory === "bug"
        ? "Bug report"
        : normalizedCategory === "feature"
          ? "Feature request"
          : normalizedCategory === "club"
            ? "Club-related message"
            : "App feedback"
    }`,
    body: [
      `Category: ${data.category}`,
      `School: ${school.name}`,
      `From: ${name || "Anonymous"}`,
      `Reply email: ${email || "Not provided"}`,
      "",
      message,
    ].join("\n"),
    type: "support_message",
  });
  revalidatePath("/admin/feedback");
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
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
}): Promise<{ success: boolean; error?: string; message?: string }> {
  if (isDemoMode()) return { success: true };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to host a workshop." };
  const profile = await createProfileIfMissing(user.id, user.email ?? "");
  if (!profile || profile.role !== "student") {
    return { success: false, error: "Only student accounts can submit workshops." };
  }
  const school = await getCurrentSchool(profile);

  const { error } = await supabase.from("workshops").insert({
    school_id: school?.id ?? DEFAULT_SCHOOL_ID,
    host_user_id: user.id,
    ...data,
    status: "pending",
  });
  if (error) return { success: false, error: friendlyError(error) };
  await createAdminAttentionNotification({
    title: "Workshop needs review",
    message: `${profile.full_name ?? profile.email ?? "A student"} submitted “${data.title}”.`,
    link: "/manage/approvals",
    schoolId: profile.school_id ?? school?.id ?? DEFAULT_SCHOOL_ID,
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
  sponsorUserId?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
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
  const school = await getCurrentSchool(profile);
  const schoolId = profile.school_id ?? school?.id ?? DEFAULT_SCHOOL_ID;
  const sponsor = await getValidTeacherSponsor({
    sponsorUserId: data.sponsorUserId || (profile.role === "teacher" ? profile.id : null),
    schoolId,
  });
  if (data.sponsorUserId && !sponsor) {
    return { success: false, error: "Choose a teacher from this school as the sponsor." };
  }
  const { data: club, error } = await admin.from("clubs").insert({
    school_id: schoolId,
    name,
    slug,
    short_description: data.shortDescription.trim() || null,
    category: data.category.trim() || "Other",
    meeting_time: null,
    meeting_location: null,
    sponsor_name: sponsor?.full_name || sponsor?.email || null,
    sponsor_email: sponsor?.email || null,
    status: "draft",
    visibility: "unlisted",
    is_listed: false,
    is_featured: false,
    is_active: false,
  }).select("id,slug").single();
  if (error) return { success: false, error: friendlyError(error, "Could not submit club proposal.") };

  if (sponsor) {
    await syncClubSponsorMembership({
      clubId: club.id,
      sponsorUserId: sponsor.id,
      schoolId,
    });
  }

  if (profile.role === "teacher") {
    await createAdminAttentionNotification({
      title: "Club proposal needs review",
      message: `${profile.full_name ?? profile.email ?? "A teacher"} proposed “${name}”.`,
      link: `/manage/clubs/${club.slug}`,
      schoolId: profile.school_id ?? school?.id ?? DEFAULT_SCHOOL_ID,
      importance: "important",
      type: "approval_needed",
    });
  }
  revalidatePath("/manage/clubs");
  revalidatePath("/manage/clubs/drafts");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: profile.role === "teacher"
      ? "A school admin can review and publish it."
      : "The draft club was created and is hidden from students.",
  };
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
  ends_at?: string;
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
  release_at?: string;
}): Promise<{ success: boolean; error?: string; approved?: boolean; scheduled?: boolean }> {
  if (isDemoMode()) return { success: true, approved: false };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };

  const club = data.clubSlug ? await getManagedClubBySlug(data.clubSlug) : null;
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
  let scheduledFor: string | null = null;
  if (data.type === "announcement" && data.release_at) {
    const parsedRelease = new Date(data.release_at);
    if (Number.isNaN(parsedRelease.getTime())) {
      return { success: false, error: "Choose a valid release date and time." };
    }
    if (parsedRelease.getTime() <= Date.now()) {
      return { success: false, error: "The scheduled release time must be in the future." };
    }
    scheduledFor = parsedRelease.toISOString();
  }
  const isScheduledAnnouncement = data.type === "announcement" && Boolean(scheduledFor);
  const contentStatus = isScheduledAnnouncement ? "draft" : trustedPost ? "approved" : "pending";
  const publishedAt = trustedPost && !isScheduledAnnouncement ? new Date().toISOString() : null;

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
      scheduled_for: scheduledFor,
    };
  } else if (data.type === "event") {
    if (!club) return { success: false, error: "A club is required." };
    if (!data.starts_at) return { success: false, error: "Start date and time are required." };
    const startsAt = new Date(data.starts_at);
    const endsAt = data.ends_at ? new Date(data.ends_at) : null;
    if (Number.isNaN(startsAt.getTime())) {
      return { success: false, error: "Start date and time are invalid." };
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return { success: false, error: "End date and time are invalid." };
    }
    if (endsAt && endsAt <= startsAt) {
      return { success: false, error: "End time must be after the start time." };
    }
    table = "events";
    insert = {
      school_id: club.school_id,
      club_id: club.id,
      created_by: profile.id,
      title: data.title,
      description: data.body,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
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
  } else if (
    trustedPost &&
    !isScheduledAnnouncement &&
    club &&
    created?.id &&
    ["announcement", "event", "resource"].includes(data.type)
  ) {
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
    const school = await getSchoolById(club.school_id);
    if (school?.slug) {
      revalidatePath(`/s/${school.slug}/calendar`);
      revalidatePath(`/s/${school.slug}/clubs/${club.slug}`);
    }
  }
  revalidatePath("/events");
  revalidatePath("/calendar");
  revalidatePath("/opportunities");
  return { success: true, approved: trustedPost, scheduled: isScheduledAnnouncement };
}

function normalizeHttpUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const COURSEWORK_BUCKET = "coursework-private";
const MAX_COURSEWORK_FILE_SIZE = 20 * 1024 * 1024;
const BLOCKED_COURSEWORK_EXTENSIONS = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "dll",
  "dmg",
  "exe",
  "html",
  "htm",
  "jar",
  "js",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
]);

function safeCourseworkFileName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[/\\\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return normalized || "attachment";
}

function validateCourseworkFile(input: {
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
}): string | null {
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return "Choose a non-empty file.";
  }
  if (input.fileSize > MAX_COURSEWORK_FILE_SIZE) {
    return "Files must be 20 MB or smaller.";
  }
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = input.mimeType?.toLowerCase() ?? "";
  if (
    BLOCKED_COURSEWORK_EXTENSIONS.has(extension)
    || mimeType.includes("javascript")
    || mimeType === "text/html"
    || mimeType === "image/svg+xml"
    || mimeType.startsWith("application/x-")
  ) {
    return "That file type is not allowed. Upload a document, image, spreadsheet, presentation, text file, or archive.";
  }
  return null;
}

async function getStudentAssignmentContext(clubSlug: string, assignmentId: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { error: "Please sign in." } as const;
  if (profile.role !== "student") {
    return { error: "Only student members can submit assignment work." } as const;
  }
  const club = await getManagedClubBySlug(clubSlug);
  if (!club) return { error: "Club not found." } as const;
  const [{ data: assignment }, { data: membership }] = await Promise.all([
    supabase
      .from("club_assignments")
      .select("*")
      .eq("id", assignmentId)
      .eq("club_id", club.id)
      .maybeSingle(),
    supabase
      .from("club_memberships")
      .select("club_id,status,role")
      .eq("club_id", club.id)
      .eq("user_id", profile.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (!assignment || !membership) return { error: "Assignment not found." } as const;
  if (assignment.status !== "published") {
    return { error: "This assignment is not accepting work." } as const;
  }
  return {
    supabase,
    profile,
    club,
    assignment: assignment as ClubAssignment,
    membership: membership as ClubMembership,
  } as const;
}

async function getCourseworkManagerContext(clubSlug: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { error: "Please sign in." } as const;
  const club = await getManagedClubBySlug(clubSlug);
  if (!club) return { error: "Club not found." } as const;
  const { data: membership } = await supabase
    .from("club_memberships")
    .select("club_id,status,role")
    .eq("club_id", club.id)
    .eq("user_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  if (!canManageClubCoursework(profile, club, membership as ClubMembership | null)) {
    return { error: "Only the teacher sponsor or a school administrator can manage assignments." } as const;
  }
  return { supabase, profile, club, membership } as const;
}

export async function createClubAssignment(data: {
  clubSlug: string;
  title: string;
  instructions: string;
  dueAt?: string | null;
  pointsPossible: number;
  attachmentUrl?: string | null;
  submissionMode?: "submission" | "completion";
  publishNow?: boolean;
  scheduledFor?: string | null;
}): Promise<{ success: boolean; error?: string; assignmentId?: string }> {
  if (isDemoMode()) return { success: true, assignmentId: "demo-assignment" };
  const context = await getCourseworkManagerContext(data.clubSlug);
  if ("error" in context) return { success: false, error: context.error };

  const title = data.title.trim();
  const instructions = data.instructions.trim();
  if (!title || title.length > 200) {
    return { success: false, error: "Assignment title must be between 1 and 200 characters." };
  }
  if (instructions.length > 20000) {
    return { success: false, error: "Assignment instructions are too long." };
  }
  const pointsPossible = Number(data.pointsPossible);
  if (!Number.isFinite(pointsPossible) || pointsPossible < 0 || pointsPossible > 10000) {
    return { success: false, error: "Points possible must be between 0 and 10,000." };
  }

  let dueAt: string | null = null;
  if (data.dueAt) {
    const parsedDueAt = new Date(data.dueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return { success: false, error: "Choose a valid due date and time." };
    }
    dueAt = parsedDueAt.toISOString();
  }

  const attachmentUrl = normalizeHttpUrl(data.attachmentUrl);
  if (data.attachmentUrl?.trim() && !attachmentUrl) {
    return { success: false, error: "The assignment link must be a valid http or https URL." };
  }
  let scheduledFor: string | null = null;
  if (data.scheduledFor) {
    const parsedRelease = new Date(data.scheduledFor);
    if (Number.isNaN(parsedRelease.getTime())) {
      return { success: false, error: "Choose a valid release date and time." };
    }
    if (parsedRelease.getTime() <= Date.now()) {
      return { success: false, error: "The scheduled release time must be in the future." };
    }
    scheduledFor = parsedRelease.toISOString();
  }
  const publishNow = data.publishNow !== false && !scheduledFor;
  const submissionMode = data.submissionMode === "completion" ? "completion" : "submission";
  const { data: assignment, error } = await context.supabase
    .from("club_assignments")
    .insert({
      club_id: context.club.id,
      author_id: context.profile.id,
      title,
      instructions,
      due_at: dueAt,
      points_possible: pointsPossible,
      attachment_url: attachmentUrl,
      submission_mode: submissionMode,
      status: publishNow ? "published" : "draft",
      published_at: publishNow ? new Date().toISOString() : null,
      scheduled_for: scheduledFor,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: friendlyError(error, "Could not create the assignment.") };

  if (publishNow) {
    await createNotificationsForClubMembers({
      clubId: context.club.id,
      type: "club_assignment_created",
      importance: "normal",
      title,
      message: `${context.club.name} posted a new assignment${dueAt ? ` due ${new Date(dueAt).toLocaleDateString()}` : ""}.`,
      link: `/clubs/${context.club.slug}/member/assignments/${assignment.id}`,
      sendEmail: false,
    });
  }

  revalidatePath(`/manage/clubs/${context.club.slug}`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework`);
  revalidatePath(`/clubs/${context.club.slug}/member`);
  return { success: true, assignmentId: assignment.id };
}

export async function updateClubAssignmentStatus(data: {
  clubSlug: string;
  assignmentId: string;
  status: Extract<AssignmentStatus, "published" | "closed" | "archived">;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const context = await getCourseworkManagerContext(data.clubSlug);
  if ("error" in context) return { success: false, error: context.error };

  const { data: existing } = await context.supabase
    .from("club_assignments")
    .select("id,status,title")
    .eq("id", data.assignmentId)
    .eq("club_id", context.club.id)
    .maybeSingle();
  if (!existing) return { success: false, error: "Assignment not found." };

  const update: Record<string, unknown> = { status: data.status };
  if (data.status === "published" && existing.status === "draft") {
    update.published_at = new Date().toISOString();
    update.scheduled_for = null;
  }
  const { error } = await context.supabase
    .from("club_assignments")
    .update(update)
    .eq("id", data.assignmentId)
    .eq("club_id", context.club.id);
  if (error) return { success: false, error: friendlyError(error, "Could not update the assignment.") };

  if (data.status === "published" && existing.status === "draft") {
    await createNotificationsForClubMembers({
      clubId: context.club.id,
      type: "club_assignment_created",
      importance: "normal",
      title: existing.title,
      message: `${context.club.name} posted a new assignment.`,
      link: `/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`,
      sendEmail: false,
    });
  }

  revalidatePath(`/manage/clubs/${context.club.slug}`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
  revalidatePath(`/clubs/${context.club.slug}/member`);
  revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
  return { success: true };
}

export async function prepareCourseworkFileUpload(data: {
  clubSlug: string;
  assignmentId: string;
  target: "assignment" | "submission";
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
}): Promise<{ success: boolean; error?: string; path?: string; token?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "File uploads are unavailable in demo mode." };
  }
  const validationError = validateCourseworkFile(data);
  if (validationError) return { success: false, error: validationError };

  const context = data.target === "assignment"
    ? await getCourseworkManagerContext(data.clubSlug)
    : await getStudentAssignmentContext(data.clubSlug, data.assignmentId);
  if ("error" in context) return { success: false, error: context.error };

  if (data.target === "assignment") {
    const { data: assignment } = await context.supabase
      .from("club_assignments")
      .select("id")
      .eq("id", data.assignmentId)
      .eq("club_id", context.club.id)
      .maybeSingle();
    if (!assignment) return { success: false, error: "Assignment not found." };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Private file storage is not configured." };
  const fileName = safeCourseworkFileName(data.fileName);
  const section = data.target === "assignment" ? "materials" : "submissions";
  const path = `${data.assignmentId}/${section}/${context.profile.id}/${randomUUID()}-${fileName}`;
  const { data: signedUpload, error } = await admin.storage
    .from(COURSEWORK_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !signedUpload?.token) {
    return { success: false, error: friendlyError(error, "Could not prepare the private upload.") };
  }
  return { success: true, path, token: signedUpload.token };
}

async function getStoredCourseworkObject(path: string): Promise<{
  size?: number | null;
  mimetype?: string | null;
} | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const separator = path.lastIndexOf("/");
  if (separator < 1) return null;
  const folder = path.slice(0, separator);
  const fileName = path.slice(separator + 1);
  const { data, error } = await admin.storage
    .from(COURSEWORK_BUCKET)
    .list(folder, { search: fileName, limit: 10 });
  if (error) return null;
  const object = data?.find((item) => item.name === fileName);
  if (!object) return null;
  const metadata = object.metadata as { size?: number; mimetype?: string } | null;
  return {
    size: metadata?.size ?? null,
    mimetype: metadata?.mimetype ?? null,
  };
}

export async function registerCourseworkFileUpload(data: {
  clubSlug: string;
  assignmentId: string;
  target: "assignment" | "submission";
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
}): Promise<{ success: boolean; error?: string; attachmentId?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "File uploads are unavailable in demo mode." };
  }
  const validationError = validateCourseworkFile(data);
  if (validationError) return { success: false, error: validationError };

  const context = data.target === "assignment"
    ? await getCourseworkManagerContext(data.clubSlug)
    : await getStudentAssignmentContext(data.clubSlug, data.assignmentId);
  if ("error" in context) return { success: false, error: context.error };

  if (data.target === "assignment") {
    const { data: assignment } = await context.supabase
      .from("club_assignments")
      .select("id")
      .eq("id", data.assignmentId)
      .eq("club_id", context.club.id)
      .maybeSingle();
    if (!assignment) return { success: false, error: "Assignment not found." };
  }

  const section = data.target === "assignment" ? "materials" : "submissions";
  const requiredPrefix = `${data.assignmentId}/${section}/${context.profile.id}/`;
  if (!data.storagePath.startsWith(requiredPrefix) || data.storagePath.includes("..")) {
    return { success: false, error: "The uploaded file path is invalid." };
  }
  const storedObject = await getStoredCourseworkObject(data.storagePath);
  if (!storedObject) {
    return { success: false, error: "The private upload did not finish. Please try again." };
  }
  const storedSize = Number(storedObject.size ?? data.fileSize);
  const storedValidationError = validateCourseworkFile({
    fileName: data.fileName,
    fileSize: storedSize,
    mimeType: storedObject.mimetype ?? data.mimeType,
  });
  if (storedValidationError) return { success: false, error: storedValidationError };

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Private file storage is not configured." };
  const insertResult = data.target === "assignment"
    ? await admin
      .from("club_assignment_attachments")
      .insert({
        assignment_id: data.assignmentId,
        uploaded_by: context.profile.id,
        source_type: "upload",
        copy_mode: "reference",
        file_name: safeCourseworkFileName(data.fileName),
        mime_type: storedObject.mimetype ?? data.mimeType?.slice(0, 255) ?? null,
        file_size: storedSize,
        storage_path: data.storagePath,
      })
      .select("id")
      .single()
    : await admin
      .from("club_submission_attachments")
      .insert({
        assignment_id: data.assignmentId,
        submission_id: null,
        student_id: context.profile.id,
        source_type: "upload",
        file_name: safeCourseworkFileName(data.fileName),
        mime_type: storedObject.mimetype ?? data.mimeType?.slice(0, 255) ?? null,
        file_size: storedSize,
        storage_path: data.storagePath,
      })
      .select("id")
      .single();
  const { data: attachment, error } = insertResult;
  if (error || !attachment) {
    await admin.storage.from(COURSEWORK_BUCKET).remove([data.storagePath]);
    return { success: false, error: friendlyError(error, "Could not attach the uploaded file.") };
  }

  revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
  return { success: true, attachmentId: attachment.id };
}

export async function registerAssignmentGoogleDriveAttachment(data: {
  clubSlug: string;
  assignmentId: string;
  fileId: string;
  copyMode: "reference" | "student_copy";
}): Promise<{ success: boolean; error?: string; attachmentId?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "Google Drive is unavailable in demo mode." };
  }
  const context = await getCourseworkManagerContext(data.clubSlug);
  if ("error" in context) return { success: false, error: context.error };
  const { data: assignment } = await context.supabase
    .from("club_assignments")
    .select("id")
    .eq("id", data.assignmentId)
    .eq("club_id", context.club.id)
    .maybeSingle();
  if (!assignment) return { success: false, error: "Assignment not found." };

  try {
    const file = await getGoogleDriveFile(context.profile.id, data.fileId);
    if (data.copyMode === "student_copy" && !isCopyableGoogleWorkspaceFile(file.mimeType)) {
      return {
        success: false,
        error: "Individual student copies are supported for Google Docs, Sheets, and Slides.",
      };
    }
    if (data.copyMode === "student_copy" && file.capabilities?.canCopy === false) {
      return { success: false, error: "Google Drive does not allow this file to be copied." };
    }
    const admin = createAdminClient();
    if (!admin) return { success: false, error: "Google Drive storage is not configured." };
    const { data: attachment, error } = await admin
      .from("club_assignment_attachments")
      .insert({
        assignment_id: data.assignmentId,
        uploaded_by: context.profile.id,
        source_type: "google_drive",
        copy_mode: data.copyMode,
        file_name: safeCourseworkFileName(file.name),
        mime_type: file.mimeType ?? null,
        file_size: file.size ? Number(file.size) : null,
        storage_path: null,
        external_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
        google_file_id: file.id,
      })
      .select("id")
      .single();
    if (error || !attachment) {
      return { success: false, error: friendlyError(error, "Could not attach the Google Drive file.") };
    }
    revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
    revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
    return { success: true, attachmentId: attachment.id };
  } catch (error) {
    return {
      success: false,
      error: isGoogleDriveReconnectError(error)
        ? "Reconnect Google Drive and try again."
        : error instanceof Error ? error.message : "Could not access that Google Drive file.",
    };
  }
}

async function getCourseworkManagerEmails(input: {
  clubId: string;
  schoolId: string;
  assignmentAuthorId?: string | null;
}): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data: sponsorRows } = await admin
    .from("club_memberships")
    .select("user_id")
    .eq("club_id", input.clubId)
    .eq("status", "active")
    .eq("role", "sponsor");
  const ids = new Set<string>(
    (sponsorRows ?? []).map((row) => row.user_id as string)
  );
  if (input.assignmentAuthorId) ids.add(input.assignmentAuthorId);
  const [clubManagers, schoolAdmins] = await Promise.all([
    ids.size
      ? admin.from("profiles").select("email").in("id", [...ids]).eq("account_status", "active")
      : Promise.resolve({ data: [] as Array<{ email?: string | null }> }),
    admin
      .from("profiles")
      .select("email")
      .eq("school_id", input.schoolId)
      .in("role", ["admin"])
      .eq("account_status", "active"),
  ]);
  return [...new Set(
    [...(clubManagers.data ?? []), ...(schoolAdmins.data ?? [])]
      .map((row) => row.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  )];
}

export async function registerSubmissionGoogleDriveAttachment(data: {
  clubSlug: string;
  assignmentId: string;
  fileId: string;
}): Promise<{ success: boolean; error?: string; warning?: string; attachmentId?: string }> {
  if (isDemoMode()) {
    return { success: false, error: "Google Drive is unavailable in demo mode." };
  }
  const context = await getStudentAssignmentContext(data.clubSlug, data.assignmentId);
  if ("error" in context) return { success: false, error: context.error };
  try {
    const file = await getGoogleDriveFile(context.profile.id, data.fileId);
    const managerEmails = await getCourseworkManagerEmails({
      clubId: context.club.id,
      schoolId: context.club.school_id,
      assignmentAuthorId: context.assignment.author_id,
    });
    const shareResults = await Promise.allSettled(
      managerEmails
        .filter((email) => email !== context.profile.email?.toLowerCase())
        .map((recipientEmail) =>
          ensureGoogleDrivePermission({
            ownerUserId: context.profile.id,
            fileId: file.id,
            recipientEmail,
            role: isGoogleWorkspaceFile(file.mimeType) ? "commenter" : "reader",
          })
        )
    );
    const shareFailures = shareResults.filter((result) => result.status === "rejected").length;

    const admin = createAdminClient();
    if (!admin) return { success: false, error: "Google Drive storage is not configured." };
    const { data: attachment, error } = await admin
      .from("club_submission_attachments")
      .insert({
        assignment_id: data.assignmentId,
        submission_id: null,
        student_id: context.profile.id,
        source_type: "google_drive",
        file_name: safeCourseworkFileName(file.name),
        mime_type: file.mimeType ?? null,
        file_size: file.size ? Number(file.size) : null,
        storage_path: null,
        external_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
        google_file_id: file.id,
      })
      .select("id")
      .single();
    if (error || !attachment) {
      return { success: false, error: friendlyError(error, "Could not attach the Google Drive file.") };
    }
    revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
    revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
    return {
      success: true,
      attachmentId: attachment.id,
      warning: shareFailures
        ? "The file was attached, but Google could not automatically share it with every coursework manager. Check its Drive sharing settings."
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: isGoogleDriveReconnectError(error)
        ? "Reconnect Google Drive and try again."
        : error instanceof Error ? error.message : "Could not access that Google Drive file.",
    };
  }
}

export async function removeCourseworkAttachment(data: {
  clubSlug: string;
  assignmentId: string;
  target: "assignment" | "submission";
  attachmentId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const context = data.target === "assignment"
    ? await getCourseworkManagerContext(data.clubSlug)
    : await getStudentAssignmentContext(data.clubSlug, data.assignmentId);
  if ("error" in context) return { success: false, error: context.error };
  if (data.target === "assignment") {
    const { data: assignment } = await context.supabase
      .from("club_assignments")
      .select("id")
      .eq("id", data.assignmentId)
      .eq("club_id", context.club.id)
      .maybeSingle();
    if (!assignment) return { success: false, error: "Assignment not found." };
  }
  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Private file storage is not configured." };
  const table = data.target === "assignment"
    ? "club_assignment_attachments"
    : "club_submission_attachments";
  let query = admin
    .from(table)
    .select("id,storage_path,source_type")
    .eq("id", data.attachmentId)
    .eq("assignment_id", data.assignmentId);
  if (data.target === "submission") query = query.eq("student_id", context.profile.id);
  const { data: attachment } = await query.maybeSingle();
  if (!attachment) return { success: false, error: "Attachment not found." };
  const { error } = await admin.from(table).delete().eq("id", data.attachmentId);
  if (error) return { success: false, error: friendlyError(error, "Could not remove the attachment.") };
  if (attachment.source_type === "upload" && attachment.storage_path) {
    await admin.storage.from(COURSEWORK_BUCKET).remove([attachment.storage_path]);
  }
  revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
  return { success: true };
}

export async function createStudentGoogleDriveCopy(data: {
  clubSlug: string;
  assignmentId: string;
  attachmentId: string;
}): Promise<{ success: boolean; error?: string; webUrl?: string }> {
  if (isDemoMode()) {
    return { success: true, webUrl: "https://docs.google.com/document/" };
  }
  const context = await getStudentAssignmentContext(data.clubSlug, data.assignmentId);
  if ("error" in context) return { success: false, error: context.error };
  const studentDriveStatus = await getGoogleDriveConnectionStatus(context.profile.id).catch(() => null);
  const studentDriveEmail = studentDriveStatus?.google_email || context.profile.email;
  if (!studentDriveEmail) {
    return { success: false, error: "Your account needs an email address before a private copy can be shared." };
  }
  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Google Drive storage is not configured." };
  const { data: existing } = await admin
    .from("club_assignment_student_copies")
    .select("web_url")
    .eq("assignment_attachment_id", data.attachmentId)
    .eq("student_id", context.profile.id)
    .maybeSingle();
  if (existing?.web_url) return { success: true, webUrl: existing.web_url };

  const { data: attachment } = await admin
    .from("club_assignment_attachments")
    .select("*")
    .eq("id", data.attachmentId)
    .eq("assignment_id", data.assignmentId)
    .eq("source_type", "google_drive")
    .eq("copy_mode", "student_copy")
    .maybeSingle();
  if (!attachment?.google_file_id || !attachment.uploaded_by) {
    return { success: false, error: "The assignment template is unavailable." };
  }

  try {
    const studentName = context.profile.full_name?.trim() || studentDriveEmail.split("@")[0];
    const copy = await copyGoogleDriveFileForStudent({
      teacherUserId: attachment.uploaded_by,
      templateFileId: attachment.google_file_id,
      copyName: `${context.assignment.title} - ${studentName}`,
      studentEmail: studentDriveEmail,
    });
    const webUrl = copy.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(copy.id)}`;
    const { error } = await admin.from("club_assignment_student_copies").insert({
      assignment_id: data.assignmentId,
      assignment_attachment_id: data.attachmentId,
      student_id: context.profile.id,
      google_file_id: copy.id,
      file_name: safeCourseworkFileName(copy.name),
      web_url: webUrl,
    });
    if (error?.code === "23505") {
      const { data: racedCopy } = await admin
        .from("club_assignment_student_copies")
        .select("web_url")
        .eq("assignment_attachment_id", data.attachmentId)
        .eq("student_id", context.profile.id)
        .single();
      return racedCopy?.web_url
        ? { success: true, webUrl: racedCopy.web_url }
        : { success: false, error: "Could not finish preparing your copy." };
    }
    if (error) return { success: false, error: friendlyError(error, "Could not save your private copy.") };
    revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
    revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
    return { success: true, webUrl };
  } catch (error) {
    return {
      success: false,
      error: isGoogleDriveReconnectError(error)
        ? "The teacher needs to reconnect Google Drive before copies can be created."
        : error instanceof Error ? error.message : "Could not create your private Google Drive copy.",
    };
  }
}

export async function disconnectGoogleDriveAction(): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Please sign in." };
  try {
    await disconnectGoogleDrive(profile.id);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not disconnect Google Drive.",
    };
  }
}

export async function submitClubAssignment(data: {
  clubSlug: string;
  assignmentId: string;
  submissionText?: string | null;
  attachmentUrl?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  if (profile.role !== "student") {
    return { success: false, error: "Only student members can submit club assignments." };
  }

  const attachmentUrl = normalizeHttpUrl(data.attachmentUrl);
  if (data.attachmentUrl?.trim() && !attachmentUrl) {
    return { success: false, error: "The submission link must be a valid http or https URL." };
  }
  const submissionText = data.submissionText?.trim() || null;
  const { data: assignment } = await supabase
    .from("club_assignments")
    .select("id,club_id,submission_mode")
    .eq("id", data.assignmentId)
    .maybeSingle();
  const club = await getManagedClubBySlug(data.clubSlug);
  if (!assignment || !club || assignment.club_id !== club.id) {
    return { success: false, error: "Assignment not found." };
  }
  if (assignment.submission_mode !== "completion" && !submissionText && !attachmentUrl) {
    const { count } = await supabase
      .from("club_submission_attachments")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", data.assignmentId)
      .eq("student_id", profile.id);
    if (!count) return { success: false, error: "Add a written response, link, or file." };
  }

  const { error } = await supabase.rpc("submit_club_assignment", {
    assignment_uuid: data.assignmentId,
    submitted_text: submissionText,
    submitted_url: attachmentUrl,
  });
  if (error) return { success: false, error: friendlyError(error, "Could not submit the assignment.") };

  revalidatePath(`/clubs/${club.slug}/member`);
  revalidatePath(`/clubs/${club.slug}/member/assignments/${data.assignmentId}`);
  revalidatePath(`/manage/clubs/${club.slug}/coursework`);
  revalidatePath(`/manage/clubs/${club.slug}/coursework/${data.assignmentId}`);
  return { success: true };
}

export async function gradeClubAssignmentSubmission(data: {
  clubSlug: string;
  assignmentId: string;
  submissionId: string;
  gradePoints: number;
  feedback?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  const context = await getCourseworkManagerContext(data.clubSlug);
  if ("error" in context) return { success: false, error: context.error };
  const { data: submission } = await context.supabase
    .from("club_assignment_submissions")
    .select("id,student_id,assignment_id")
    .eq("id", data.submissionId)
    .eq("assignment_id", data.assignmentId)
    .maybeSingle();
  const { data: assignment } = await context.supabase
    .from("club_assignments")
    .select("*")
    .eq("id", data.assignmentId)
    .eq("club_id", context.club.id)
    .maybeSingle();
  if (!submission || !assignment) return { success: false, error: "Submission not found." };

  const { error } = await context.supabase.rpc("grade_club_assignment_submission", {
    submission_uuid: data.submissionId,
    awarded_points: data.gradePoints,
    grader_feedback: data.feedback?.trim() || null,
  });
  if (error) return { success: false, error: friendlyError(error, "Could not return this grade.") };

  const typedAssignment = assignment as ClubAssignment;
  const typedSubmission = submission as Pick<ClubAssignmentSubmission, "student_id">;
  await createNotification({
    recipientUserId: typedSubmission.student_id,
    type: "club_assignment_graded",
    importance: "normal",
    title: `${typedAssignment.title} was graded`,
    message: `Your work in ${context.club.name} has been returned with a grade and feedback.`,
    link: `/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`,
    clubId: context.club.id,
  });

  revalidatePath(`/manage/clubs/${context.club.slug}/coursework`);
  revalidatePath(`/manage/clubs/${context.club.slug}/coursework/${data.assignmentId}`);
  revalidatePath(`/clubs/${context.club.slug}/member`);
  revalidatePath(`/clubs/${context.club.slug}/member/assignments/${data.assignmentId}`);
  return { success: true };
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
  const { error } = await supabase.rpc("admin_set_user_role_and_clubs", {
    target_user_id: data.targetUserId,
    new_role: data.role,
    assigned_club_ids: data.role === "teacher" ? data.clubIds : [],
  });
  if (error) return { success: false, error: friendlyError(error, "Could not update this user.") };

  if (data.role !== target.role) {
    const promoted = userRoleRank(data.role) > userRoleRank(target.role);
    const roleLabel = data.role.replace("_", " ");
    await createNotification({
      recipientUserId: target.id,
      type: "system_message",
      importance: promoted ? "important" : "normal",
      title: promoted ? `You were promoted to ${roleLabel}` : `Your account role is now ${roleLabel}`,
      message: promoted
        ? `An administrator promoted your StormHub account. Your homepage checklist has been reset for your new responsibilities.`
        : `An administrator changed your StormHub account role to ${roleLabel}.`,
      link: data.role === "super_admin" ? "/admin/schools" : data.role === "admin" || data.role === "teacher" ? "/manage" : "/dashboard",
      sendEmail: promoted,
    });
  }

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
  if (!isAdminRole(actor.role)) return { success: false, error: "Administrator access required." };

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

  const [{ data: authoredFiles }, { data: submittedFiles }] = await Promise.all([
    admin
      .from("club_assignment_attachments")
      .select("storage_path")
      .eq("uploaded_by", targetUserId)
      .eq("source_type", "upload"),
    admin
      .from("club_submission_attachments")
      .select("storage_path")
      .eq("student_id", targetUserId)
      .eq("source_type", "upload"),
  ]);
  const storagePaths = [...(authoredFiles ?? []), ...(submittedFiles ?? [])]
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length) {
    const { error: storageError } = await admin.storage
      .from(COURSEWORK_BUCKET)
      .remove(storagePaths);
    if (storageError) {
      return { success: false, error: "Could not remove the account's private coursework files." };
    }
  }
  await disconnectGoogleDrive(targetUserId).catch(() => undefined);

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

export async function updateUserAccountStatus(
  targetUserId: string,
  status: AccountStatus
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Account status changes are unavailable in demo mode." };
  const supabase = await createClient();
  const admin = createAdminClient();
  const actor = await getCurrentProfile();
  if (!supabase || !admin || !actor) return { success: false, error: "Administrator configuration is incomplete." };
  if (!isAdminRole(actor.role)) return { success: false, error: "Administrator access required." };

  const { data: targetData, error: targetError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetError || !targetData) return { success: false, error: "User not found." };
  const target = targetData as Profile;
  if (target.id === actor.id) return { success: false, error: "You cannot change your own account status." };
  if (actor.role !== "super_admin" && (
    target.school_id !== actor.school_id || !["student", "teacher"].includes(target.role)
  )) {
    return { success: false, error: "You do not have permission to change this account." };
  }

  const previousStatus = target.account_status ?? "active";
  const banDuration = status === "active" ? "none" : "876000h";
  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
  if (authError) return { success: false, error: authError.message || "Could not update authentication status." };

  const { error } = await supabase.rpc("admin_set_account_status", {
    target_user_id: targetUserId,
    new_status: status,
  });
  if (error) {
    await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: previousStatus === "active" ? "none" : "876000h",
    });
    return { success: false, error: friendlyError(error, "Could not update account status.") };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deactivateGraduatingStudents(
  graduationYear: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Graduation cleanup is unavailable in demo mode." };
  if (!Number.isInteger(graduationYear) || graduationYear < 2000 || graduationYear > 2200) {
    return { success: false, error: "Choose a valid graduation year." };
  }
  const supabase = await createClient();
  const admin = createAdminClient();
  const actor = await getCurrentProfile();
  if (!supabase || !admin || !actor || !isAdminRole(actor.role)) {
    return { success: false, error: "Administrator configuration is incomplete." };
  }

  let query = supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("grade_level", 12)
    .eq("account_status", "active");
  if (actor.role !== "super_admin") query = query.eq("school_id", actor.school_id);
  const { data: students, error: lookupError } = await query;
  if (lookupError) return { success: false, error: friendlyError(lookupError, "Could not load graduating students.") };

  let completed = 0;
  for (const student of students ?? []) {
    const { error: statusError } = await supabase.rpc("admin_set_account_status", {
      target_user_id: student.id,
      new_status: "deactivated",
    });
    if (statusError) continue;
    const [{ error: profileError }, { error: authError }] = await Promise.all([
      admin.from("profiles").update({ graduation_year: graduationYear }).eq("id", student.id),
      admin.auth.admin.updateUserById(student.id, { ban_duration: "876000h" }),
    ]);
    if (!profileError && !authError) completed += 1;
  }

  revalidatePath("/admin/users");
  return completed === (students?.length ?? 0)
    ? { success: true, count: completed }
    : { success: false, count: completed, error: `Deactivated ${completed} of ${students?.length ?? 0} students. Review the audit log before retrying.` };
}

export async function requestAccountDeletion(
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Deletion requests are unavailable in demo mode." };
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!supabase || !profile) return { success: false, error: "Please sign in." };
  const normalizedReason = reason?.trim().slice(0, 1000) || null;
  const { error } = await supabase.from("account_deletion_requests").insert({
    user_id: profile.id,
    school_id: profile.school_id ?? null,
    reason: normalizedReason,
  });
  if (error?.code === "23505") return { success: false, error: "You already have a pending deletion request." };
  if (error) return { success: false, error: friendlyError(error, "Could not submit deletion request.") };
  revalidatePath("/settings");
  return { success: true };
}

export async function reviewAccountDeletionRequest(data: {
  requestId: string;
  decision: "reject" | "complete";
  reviewerNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: "Deletion review is unavailable in demo mode." };
  const supabase = await createClient();
  const admin = createAdminClient();
  const actor = await getCurrentProfile();
  if (!supabase || !admin || !actor || !isAdminRole(actor.role)) {
    return { success: false, error: "Administrator configuration is incomplete." };
  }

  const { data: request, error: requestError } = await supabase
    .from("account_deletion_requests")
    .select("id,user_id,status")
    .eq("id", data.requestId)
    .maybeSingle();
  if (requestError || !request) return { success: false, error: "Deletion request not found." };
  if (request.status !== "pending") return { success: false, error: "This request has already been reviewed." };

  const reviewerNotes = data.reviewerNotes?.trim().slice(0, 2000) || null;
  if (data.decision === "reject") {
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "rejected",
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: reviewerNotes,
      })
      .eq("id", request.id)
      .eq("status", "pending");
    if (error) return { success: false, error: friendlyError(error, "Could not reject this request.") };
    revalidatePath("/admin/deletion-requests");
    return { success: true };
  }

  if (!request.user_id) return { success: false, error: "The requested account no longer exists." };
  const { error: approvalError } = await supabase
    .from("account_deletion_requests")
    .update({
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes,
    })
    .eq("id", request.id)
    .eq("status", "pending");
  if (approvalError) return { success: false, error: friendlyError(approvalError, "Could not approve this request.") };

  const deletion = await deleteUserAccount(request.user_id);
  if (!deletion.success) {
    await admin.from("account_deletion_requests").update({ status: "pending" }).eq("id", request.id);
    return deletion;
  }

  const { error: completionError } = await admin
    .from("account_deletion_requests")
    .update({ status: "completed" })
    .eq("id", request.id);
  if (completionError) {
    return { success: false, error: "The account was deleted, but the request could not be marked completed. Review the audit log." };
  }

  revalidatePath("/admin/deletion-requests");
  revalidatePath("/admin/users");
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
  const { data: targetMembership } = await supabase
    .from("club_memberships")
    .select("role,status")
    .eq("club_id", data.clubId)
    .eq("user_id", data.userId)
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
    const previousRole = (targetMembership?.role as MembershipRole | undefined) ?? "member";
    const isPromotion = membershipRoleRank(nextRole) > membershipRoleRank(previousRole);
    await createNotification({
      recipientUserId: data.userId,
      type: "system_message",
      importance: isPromotion ? "important" : "normal",
      title: isPromotion ? `You were promoted in ${club.name}` : `Club role updated: ${club.name}`,
      message: isPromotion
        ? `Your role in ${club.name} is now ${formatMembershipRole(nextRole)}. Your homepage checklist has been reset for your new responsibilities.`
        : `Your role in ${club.name} is now ${formatMembershipRole(nextRole)}.`,
      link: `/clubs/${club.slug}/member`,
      clubId: club.id,
      sendEmail: isPromotion,
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
  category?: string;
  shortDescription: string;
  longDescription?: string;
  joinInstructions?: string;
  sponsorUserId?: string;
  status: "draft" | "interest_open" | "active" | "paused" | "archived";
  visibility: "public" | "unlisted" | "private";
  isListed: boolean;
  isFeatured: boolean;
}): Promise<{ success: boolean; error?: string; message?: string }> {
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
  const canManagePublication = canManageClubPublication(profile, club as Club);
  if (
    !canManagePublication &&
    (
      data.status !== club.status ||
      data.visibility !== club.visibility ||
      data.isListed !== club.is_listed
    )
  ) {
    return {
      success: false,
      error: "Only a school administrator can publish, unpublish, list, or change a club's visibility.",
    };
  }
  if (!canManagePublication && data.isFeatured !== club.is_featured) {
    return { success: false, error: "Only a school administrator can feature or unfeature a club." };
  }

  const willPublish =
    canManagePublication &&
    club.status === "draft" &&
    ["interest_open", "active"].includes(data.status) &&
    data.visibility === "public" &&
    data.isListed;
  const sponsor = canManagePublication
    ? await getValidTeacherSponsor({
        sponsorUserId: data.sponsorUserId,
        schoolId: club.school_id,
      })
    : null;
  if (canManagePublication && data.sponsorUserId && !sponsor) {
    return { success: false, error: "Choose a teacher from this school as the sponsor." };
  }

  const clubUpdate: Record<string, unknown> = {
    name: data.name,
    category: data.category?.trim() || null,
    short_description: data.shortDescription,
    long_description: data.longDescription?.trim() || null,
    join_instructions: data.joinInstructions?.trim() || null,
    meeting_time: null,
    meeting_location: null,
  };
  if (canManagePublication) {
    Object.assign(clubUpdate, {
      sponsor_name: sponsor?.full_name || sponsor?.email || null,
      sponsor_email: sponsor?.email || null,
      status: data.status,
      visibility: data.visibility,
      is_listed: data.isListed,
      is_featured: data.isFeatured,
      is_active: ["interest_open", "active"].includes(data.status),
    });
  }

  const { error } = await supabase.from("clubs").update(clubUpdate).eq("id", data.clubId);
  if (error) return { success: false, error: friendlyError(error, "Could not update the club.") };

  if (canManagePublication) {
    await syncClubSponsorMembership({
      clubId: club.id,
      sponsorUserId: sponsor?.id ?? null,
      schoolId: club.school_id,
    });
  }

  if (willPublish) {
    await notifySchoolStudentsAboutPublishedClub({
      club: {
        ...club,
        name: data.name,
        category: data.category?.trim() || club.category,
        short_description: data.shortDescription,
        long_description: data.longDescription?.trim() || club.long_description,
        join_instructions: data.joinInstructions?.trim() || club.join_instructions,
        meeting_time: null,
        meeting_location: null,
        status: data.status,
        visibility: data.visibility,
        is_listed: data.isListed,
        is_active: true,
      },
    });
  }

  revalidatePath(`/manage/clubs/${club.slug}`);
  revalidatePath(`/manage/clubs/${club.slug}/edit`);
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  revalidatePath("/manage/clubs/drafts");
  return {
    success: true,
    message: willPublish ? "The club is now live. Students at this school were notified by email." : undefined,
  };
}

export async function deleteServiceHour(id: string): Promise<{ success: boolean; error?: string }> {
  void id;
  // TODO: Volunteering/service hours disabled because school uses a separate system.
  return { success: false, error: "Service-hour tracking is handled through the school’s separate system." };
}

export async function demoSignIn(email: string, password: string, captchaToken?: string | null): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  if (!isDemoMode()) {
    return supabaseSignIn(email, password, captchaToken);
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

export async function supabaseSignIn(email: string, password: string, captchaToken?: string | null) {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) return { success: false, error: friendlyError(error, "Sign in failed.") };
  if (data.user) {
    const profile = await createProfileIfMissing(data.user.id, data.user.email ?? "", data.user.user_metadata?.full_name as string);
    return { success: true, redirectTo: defaultPathForProfile(profile) };
  }
  return { success: true };
}

export async function completeGoogleOnboarding(input: {
  schoolId: string;
  fullName: string;
  gradeLevel?: string;
  accessCode?: string;
  next?: string;
}): Promise<{ success: true; redirectTo: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return { success: false, error: "Account setup is not configured for this deployment." };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return { success: false, error: "Your Google session expired. Sign in again." };
  }

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  if (user.app_metadata?.provider !== "google" && !providers.includes("google")) {
    return { success: false, error: "Finish this account using Google sign-in." };
  }

  const requiredAccessCode = process.env.SIGNUP_ACCESS_CODE?.trim();
  if (requiredAccessCode && input.accessCode?.trim() !== requiredAccessCode) {
    return { success: false, error: "Enter the correct school signup code." };
  }

  const normalizedFullName = input.fullName.trim().replace(/\s+/g, " ");
  if (normalizedFullName.length < 3 || normalizedFullName.length > 120) {
    return { success: false, error: "Enter your full name." };
  }
  if (!input.schoolId) {
    return { success: false, error: "Choose your school." };
  }

  const { data: existingProfile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { success: false, error: "We couldn't load your account. Please try again." };
  }
  if (existingProfile?.school_id || existingProfile?.role === "super_admin") {
    return {
      success: true,
      redirectTo: safeAuthRedirectPath(input.next, defaultPathForProfile(existingProfile as Profile)),
    };
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id,is_active,is_public,allowed_email_domains")
    .eq("id", input.schoolId)
    .maybeSingle();
  if (schoolError) {
    return { success: false, error: "We couldn't verify your school right now. Please try again." };
  }
  if (!school || school.is_active === false || school.is_public === false) {
    return { success: false, error: "Choose an active school." };
  }

  const allowedDomains = getAllowedSignupDomains(
    school.allowed_email_domains,
    process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS
  );
  const domainError = validateSignupEmailDomain(
    user.email,
    allowedDomains,
    process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS
  );
  if (domainError) return { success: false, error: domainError };

  const parsedGrade = Number(input.gradeLevel);
  const gradeLevel = Number.isInteger(parsedGrade) && parsedGrade >= 9 && parsedGrade <= 12
    ? parsedGrade
    : null;
  const profileValues = {
    email: user.email.trim().toLowerCase(),
    full_name: normalizedFullName,
    grade_level: gradeLevel,
    school_id: school.id,
    role: "student" as const,
    account_status: "active" as const,
  };

  const profileMutation = existingProfile
    ? admin
        .from("profiles")
        .update(profileValues)
        .eq("id", user.id)
        .is("school_id", null)
        .select("*")
        .maybeSingle()
    : admin
        .from("profiles")
        .insert({ id: user.id, ...profileValues })
        .select("*")
        .maybeSingle();
  const { data: completedProfile, error: updateError } = await profileMutation;
  if (updateError || !completedProfile) {
    return { success: false, error: "We couldn't finish setting up your account. Please try again." };
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    redirectTo: safeAuthRedirectPath(input.next, defaultPathForProfile(completedProfile as Profile)),
  };
}

export async function supabaseSignUp(
  email: string,
  password: string,
  fullName: string,
  gradeLevel?: number | null,
  accessCode?: string,
  schoolId?: string | null,
  botProof?: SignupBotProof
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
  const requiredAccessCode = process.env.SIGNUP_ACCESS_CODE?.trim();
  const botProofError = validateSignupBotProof(botProof);
  if (botProofError) return { success: false, error: botProofError };
  if (normalizedFullName.length < 3 || normalizedFullName.length > 120) {
    return { success: false, error: "Enter your full name." };
  }
  if (password.length < 12) {
    return { success: false, error: "Password must be at least 12 characters." };
  }
  if (requiredAccessCode && accessCode?.trim() !== requiredAccessCode) {
    return { success: false, error: "Enter the correct school signup code." };
  }
  if (!schoolId) {
    return { success: false, error: "Choose your school." };
  }
  const admin = createAdminClient();
  const db = admin ?? await createClient();
  if (!db) return { success: false, error: "Database not configured." };

  let signupAttemptId: string | null = null;
  if (admin) {
    const fingerprintSecret =
      process.env.SIGNUP_RATE_LIMIT_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (fingerprintSecret) {
      const requestHeaders = await headers();
      const clientAddress = getClientAddress(requestHeaders);
      const config = getSignupRateLimitConfig();
      const since = new Date(Date.now() - config.windowMinutes * 60 * 1000).toISOString();
      const emailHash = hashSignupIdentifier(normalizedEmail, fingerprintSecret);
      const ipHash = clientAddress ? hashSignupIdentifier(clientAddress, fingerprintSecret) : null;
      const emailCountQuery = admin
        .from("signup_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash)
        .gte("created_at", since);
      const ipCountQuery = ipHash
        ? admin
            .from("signup_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since)
        : Promise.resolve({ count: 0, error: null });
      const [emailCount, ipCount] = await Promise.all([emailCountQuery, ipCountQuery]);
      if (!emailCount.error && (emailCount.count ?? 0) >= config.maxEmailAttempts) {
        return { success: false, error: "Too many signup attempts. Wait before trying this email again." };
      }
      if (!ipCount.error && (ipCount.count ?? 0) >= config.maxIpAttempts) {
        return { success: false, error: "Too many signup attempts from this network. Try again later." };
      }
      const { data: attempt, error: attemptError } = await admin
        .from("signup_attempts")
        .insert({ email_hash: emailHash, ip_hash: ipHash })
        .select("id")
        .single();
      if (attemptError) console.warn("[supabaseSignUp] Signup throttling unavailable:", attemptError.message);
      signupAttemptId = attempt?.id ?? null;
    }
  }
  const { data: school, error: schoolError } = await db
    .from("schools")
    .select("id, is_active, is_public")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolError) {
    console.error("[supabaseSignUp] Could not verify school:", schoolError.message);
    return { success: false, error: "We couldn't verify your school right now. Please try again." };
  }
  if (!school || school.is_active === false || school.is_public === false) {
    return { success: false, error: "Choose an active school." };
  }

  const { data: schoolSignupConfig, error: signupConfigError } = await db
    .from("schools")
    .select("allowed_email_domains")
    .eq("id", schoolId)
    .maybeSingle();
  const usesLegacySchoolSchema = isMissingAllowedEmailDomainsColumn(signupConfigError);
  if (signupConfigError && !usesLegacySchoolSchema) {
    console.error("[supabaseSignUp] Could not read school signup settings:", signupConfigError.message);
    return { success: false, error: "We couldn't verify your school's signup settings right now. Please try again." };
  }
  if (usesLegacySchoolSchema) {
    console.warn(
      "[supabaseSignUp] schools.allowed_email_domains is not deployed; using legacy signup rules until the migration is applied."
    );
  }

  const normalizedGrade = typeof gradeLevel === "number" && gradeLevel >= 6 && gradeLevel <= 12
    ? gradeLevel
    : null;
  const allowedDomains = getAllowedSignupDomains(
    schoolSignupConfig?.allowed_email_domains,
    process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS
  );
  if (!usesLegacySchoolSchema || allowedDomains.length > 0) {
    const domainError = validateSignupEmailDomain(
      normalizedEmail,
      allowedDomains,
      process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS
    );
    if (domainError) return { success: false, error: domainError };
  }
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { full_name: normalizedFullName, grade_level: normalizedGrade, school_id: schoolId },
      emailRedirectTo: getAuthCallbackUrl(),
      ...(botProof?.captchaToken ? { captchaToken: botProof.captchaToken } : {}),
    },
  });
  if (error) {
    console.error("[supabaseSignUp] Supabase Auth signup failed:", {
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return { success: false, error: friendlyAuthEmailError(error) };
  }
  if (data.session) {
    await supabase.auth.signOut();
    if (admin && data.user) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(data.user.id);
      if (rollbackError) {
        console.error("[supabaseSignUp] Could not roll back an auto-confirmed signup:", rollbackError.message);
      }
    }
    return {
      success: false,
      error: "Email verification is temporarily unavailable. Please contact support before trying again.",
    };
  }
  if (admin && signupAttemptId) {
    await admin.from("signup_attempts").update({ was_successful: true }).eq("id", signupAttemptId);
  }
  return { success: true, needsConfirmation: true };
}

export async function supabaseResendConfirmation(email: string, captchaToken?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
      ...(captchaToken ? { captchaToken } : {}),
    },
  });
  if (error) {
    console.error("[supabaseResendConfirmation] Supabase Auth email failed:", {
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return {
      success: false,
      error: friendlyAuthEmailError(error, "We couldn't resend the verification email. Please try again later."),
    };
  }
  return { success: true };
}

export async function updateSchoolSignupDomains(input: {
  schoolId: string;
  domains: string;
}): Promise<{ success: boolean; domains?: string[]; error?: string }> {
  const actor = await getCurrentProfile();
  if (!actor || !["admin", "super_admin"].includes(actor.role)) {
    return { success: false, error: "Administrator access required." };
  }
  if (actor.role !== "super_admin" && actor.school_id !== input.schoolId) {
    return { success: false, error: "You can only change signup settings for your own school." };
  }

  const { domains, invalidDomains } = parseSignupDomainInput(input.domains);
  if (invalidDomains.length > 0) {
    return { success: false, error: `Remove invalid domains: ${invalidDomains.join(", ")}.` };
  }
  if (domains.length === 0) {
    return { success: false, error: "Enter at least one email domain, or * to allow every domain." };
  }
  if (domains.includes("*") && domains.length > 1) {
    return { success: false, error: "Use * by itself to allow every email domain." };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Database not configured." };
  const { data, error } = await supabase.rpc("set_school_signup_domains", {
    target_school_id: input.schoolId,
    requested_domains: domains,
  });
  if (error) {
    console.error("[updateSchoolSignupDomains]", error.message);
    if (error.code === "42883" || error.message.includes("does not exist")) {
      return { success: false, error: "Apply the latest database migrations before changing signup domains." };
    }
    return { success: false, error: friendlyError(error, "Could not update accepted email domains.") };
  }

  revalidatePath("/manage");
  revalidatePath("/admin/schools");
  return { success: true, domains: Array.isArray(data) ? data : domains };
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

export async function checkMembership(slug: string, schoolId?: string | null): Promise<boolean> {
  if (isDemoMode()) {
    const memberships = await getDemoMemberships();
    return memberships.has(slug);
  }

  const supabase = await createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const club = await getClubBySlug(slug, schoolId);
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

export async function getUserOpportunitySignupIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEMO_OPPORTUNITY_SIGNUPS_COOKIE)?.value;
    try {
      return raw ? new Set(JSON.parse(raw) as string[]) : demoState.opportunitySignups;
    } catch {
      return demoState.opportunitySignups;
    }
  }
  const supabase = await createClient();
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("opportunity_signups")
    .select("opportunity_id")
    .eq("user_id", userId)
    .eq("status", "registered");
  if (error) {
    if (error.code !== "42P01") console.error("[getUserOpportunitySignupIds]", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.opportunity_id).filter(Boolean) as string[]);
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
  if (contentType === "event") revalidatePath(`/events/${id}`);
  const school = await getSchoolById(club.school_id);
  if (school?.slug) {
    revalidatePath(`/s/${school.slug}/calendar`);
    revalidatePath(`/s/${school.slug}/clubs/${club.slug}`);
  }
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
  if (!profile || profile.role !== "super_admin") return { success: false, error: "Platform administrator access required." };
  const result = await processEmailOutbox();
  revalidatePath("/manage");
  revalidatePath("/manage/email-outbox");
  return { success: true, ...result };
}
