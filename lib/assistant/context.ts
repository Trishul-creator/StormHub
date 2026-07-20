import "server-only";

import { getAuthContext } from "@/lib/auth";
import { getOpportunities } from "@/lib/data";
import { getCurrentSchool } from "@/lib/schools";
import { formatDateTime } from "@/lib/utils";
import type { AuthContext } from "@/lib/auth";
import type { Club, Opportunity } from "@/types/database";

function list(items: string[], empty = "None"): string {
  return items.length ? items.join("\n") : empty;
}

function opportunityLine(opportunity: Opportunity): string {
  const deadline = opportunity.deadline ? `, deadline ${formatDateTime(opportunity.deadline)}` : "";
  return `- ${opportunity.title}${opportunity.category ? ` [${opportunity.category}]` : ""}${deadline}; opportunityId=${opportunity.id} → /opportunities/${opportunity.slug}`;
}

function clubLine(club: Club): string {
  return `- ${club.name}${club.category ? ` [${club.category}]` : ""}: ${club.short_description ?? "No description"} → /clubs/${club.slug}`;
}

export async function getAssistantContext(): Promise<{ auth: AuthContext; context: string }> {
  const auth = await getAuthContext();
  const profile = auth.profile;
  if (!auth.userId || !profile) return { auth, context: "" };

  const [publicClubs, publicOpportunities, school] = await Promise.all([
    getManageablePublicClubs(),
    getOpportunities({}),
    getCurrentSchool(profile),
  ]);

  const roleNotes =
    profile.role === "student"
      ? "Students can join clubs, RSVP to events, save/sign up for opportunities, read notifications, and contact support. If they are a club officer or president, they can create club announcements, events, and resources."
      : profile.role === "teacher"
        ? "Teachers can manage assigned clubs, rosters, events, announcements, resources, and archive/delete club content for clubs they sponsor."
        : "Admins can manage users, clubs, opportunities, notifications, and school-wide settings. Super admins can access the portal and create school workspaces, but should not receive school-specific task notifications.";

  const context = `
StormHub context for ${school?.name ?? "the current school"}

User access level:
- Role: ${profile.role}

Role rules:
${roleNotes}

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
