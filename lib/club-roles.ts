import type { MembershipRole } from "@/types/database";

export type ClubRoleKey = "advisor" | "president" | "vice_president" | "member";

export type ClubRoleDefinition = {
  key: ClubRoleKey;
  membershipRole: MembershipRole;
  label: string;
  counterpart: string;
  summary: string;
  capabilities: string[];
};

export const CLUB_ROLE_DEFINITIONS: ClubRoleDefinition[] = [
  {
    key: "advisor",
    membershipRole: "sponsor",
    label: "Advisor",
    counterpart: "Teacher sponsor",
    summary: "Adult oversight for safety, coursework, approvals, and compliance.",
    capabilities: [
      "Approve and archive club content and major events",
      "Create, publish, grade, and override club coursework",
      "Manage leadership and the full member roster",
      "Edit or archive the club and review club insights",
    ],
  },
  {
    key: "president",
    membershipRole: "president",
    label: "President",
    counterpart: "Student club manager",
    summary: "Runs the club workflow and publishes work for members.",
    capabilities: [
      "Create and publish assignments with due dates",
      "Publish announcements, resources, and member notifications",
      "Edit the club profile and dashboard content",
      "Review completion and submission status without private work",
    ],
  },
  {
    key: "vice_president",
    membershipRole: "officer",
    label: "Vice President",
    counterpart: "Student content and roster coordinator",
    summary: "Prepares content and keeps participation records organized.",
    capabilities: [
      "Create assignment, announcement, resource, and event drafts",
      "Track completion and submission status without private work",
      "Record event attendance",
      "Maintain general members without changing leadership",
    ],
  },
  {
    key: "member",
    membershipRole: "member",
    label: "Member",
    counterpart: "Student contributor",
    summary: "Participates in club activities and completes assigned work.",
    capabilities: [
      "View the member dashboard and club directory",
      "RSVP to meetings and events",
      "View assignments and submit files, links, or completion",
      "See personal grades and private feedback",
    ],
  },
];

const roleByMembership = new Map(
  CLUB_ROLE_DEFINITIONS.map((role) => [role.membershipRole, role])
);

export function clubRoleDefinition(role: MembershipRole): ClubRoleDefinition {
  return roleByMembership.get(role) ?? CLUB_ROLE_DEFINITIONS[3];
}

export function clubRoleLabel(role: MembershipRole): string {
  return clubRoleDefinition(role).label;
}

export function clubRoleRank(role: MembershipRole): number {
  return {
    member: 1,
    officer: 2,
    president: 3,
    sponsor: 4,
  }[role];
}
