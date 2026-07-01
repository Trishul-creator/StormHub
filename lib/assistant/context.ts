import "server-only";

import { getAuthContext, hasManagementAccess } from "@/lib/auth";
import {
  getManageableClubs,
  getOpportunities,
  getPendingApprovals,
  getStudentDashboard,
} from "@/lib/data";
import { getUserNotifications } from "@/lib/notifications";
import { getCurrentSchool } from "@/lib/schools";
import { formatDateTime } from "@/lib/utils";
import { isAdminRole } from "@/lib/permissions";
import type { AuthContext } from "@/lib/auth";
import type { Club, ClubAnnouncement, ClubMembership, Event, Notification, Opportunity } from "@/types/database";

function list(items: string[], empty = "None"): string {
  return items.length ? items.join("\n") : empty;
}

function eventLine(event: Event): string {
  return `- ${event.title}${event.club?.name ? ` (${event.club.name})` : ""}: ${formatDateTime(event.starts_at)}${event.location ? ` at ${event.location}` : ""}; eventId=${event.id} → /events/${event.id}`;
}

function opportunityLine(opportunity: Opportunity): string {
  const deadline = opportunity.deadline ? `, deadline ${formatDateTime(opportunity.deadline)}` : "";
  return `- ${opportunity.title}${opportunity.category ? ` [${opportunity.category}]` : ""}${deadline}; opportunityId=${opportunity.id} → /opportunities/${opportunity.slug}`;
}

function membershipLine(membership: ClubMembership): string {
  return `- ${membership.club?.name ?? membership.club_id}: ${membership.role} → ${membership.club?.slug ? `/clubs/${membership.club.slug}/member` : "/my-clubs"}`;
}

function clubLine(club: Club): string {
  return `- ${club.name}${club.category ? ` [${club.category}]` : ""}: ${club.short_description ?? "No description"} → /clubs/${club.slug}`;
}

function notificationLine(notification: Notification): string {
  return `- ${notification.title}: ${notification.message}; notificationId=${notification.id}${notification.link ? ` → ${notification.link}` : ""}`;
}

function announcementLine(announcement: ClubAnnouncement & { club?: Club }): string {
  return `- ${announcement.title}${announcement.club?.name ? ` (${announcement.club.name})` : ""}: ${announcement.body.slice(0, 120)}${announcement.body.length > 120 ? "..." : ""}`;
}

export async function getAssistantContext(): Promise<{ auth: AuthContext; context: string }> {
  const auth = await getAuthContext();
  const profile = auth.profile;
  if (!auth.userId || !profile) return { auth, context: "" };

  const [dashboard, manageableClubs, notifications, publicClubs, publicOpportunities, school] = await Promise.all([
    getStudentDashboard(auth.userId),
    hasManagementAccess(profile).then((canManage) => canManage ? getManageableClubs(profile) : Promise.resolve([])),
    getUserNotifications(auth.userId, 8),
    getManageablePublicClubs(),
    getOpportunities({}),
    getCurrentSchool(profile),
  ]);

  const pendingApprovals =
    profile.role === "teacher" || isAdminRole(profile.role)
      ? await getPendingApprovals()
      : [];

  const roleNotes =
    profile.role === "student"
      ? "Students can join clubs, RSVP to events, save/sign up for opportunities, read notifications, and contact support. If they are a club officer or president, they can create club announcements, events, and resources."
      : profile.role === "teacher"
        ? "Teachers can manage assigned clubs, rosters, events, announcements, resources, and archive/delete club content for clubs they sponsor."
        : "Admins can manage users, clubs, opportunities, notifications, and school-wide settings. Super admins can access the portal and create school workspaces, but should not receive school-specific task notifications.";

  const context = `
StormHub context for ${school?.name ?? "the current school"}

Current user:
- Name: ${profile.full_name ?? "Unknown"}
- Email: ${profile.email ?? "Unknown"}
- Role: ${profile.role}
- Can manage clubs: ${manageableClubs.length > 0 || isAdminRole(profile.role) ? "yes" : "no"}

Role rules:
${roleNotes}

Joined clubs:
${list(dashboard.memberships.slice(0, 10).map(membershipLine))}

Clubs this user manages:
${list(manageableClubs.slice(0, 10).map(clubLine))}

Upcoming events and RSVP-related calendar items:
${list(dashboard.upcomingEvents.slice(0, 10).map(eventLine))}

Saved opportunities:
${list(dashboard.savedOpportunities.slice(0, 8).map(opportunityLine))}

Recommended opportunities:
${list(dashboard.recommendedOpportunities.slice(0, 6).map(opportunityLine))}

Recent club announcements:
${list(dashboard.recentAnnouncements.slice(0, 5).map(announcementLine))}

Unread/recent notifications:
${list(notifications.filter((notification) => !notification.read_at).slice(0, 6).map(notificationLine))}

Pending approvals visible to this user:
${list(pendingApprovals.slice(0, 8).map((item) => `- ${item.title} (${item.type}) from ${item.context} → /manage/approvals`))}

Public clubs users can browse:
${list(publicClubs.slice(0, 12).map(clubLine))}

Public opportunities users can browse:
${list(publicOpportunities.slice(0, 12).map(opportunityLine))}

Known StormHub pages:
- /clubs: browse clubs
- /calendar: calendar and RSVP events
- /opportunities: browse opportunities
- /saved: saved/sign-up opportunity list
- /my-clubs: joined clubs
- /notifications: notifications
- /contact: support form
- /dashboard: role-specific dashboard
- /manage: club/content management for officers, presidents, teachers, and admins
`.trim();

  return { auth, context };
}

async function getManageablePublicClubs(): Promise<Club[]> {
  const { getClubs } = await import("@/lib/data");
  return getClubs({});
}
