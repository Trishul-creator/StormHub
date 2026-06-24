import type {
  Club,
  ClubMembership,
  Profile,
  UserRole,
} from "@/types/database";

const OFFICER_ROLES = [
  "officer",
  "president",
] as const;

const ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];
const MANAGER_ROLES: UserRole[] = ["teacher", "admin", "super_admin"];
const APPROVER_ROLES: UserRole[] = ["teacher", "admin", "super_admin"];

export function isAdminRole(role?: string | null): boolean {
  return !!role && ADMIN_ROLES.includes(role as UserRole);
}

export function isManagerRole(role?: string | null): boolean {
  return !!role && MANAGER_ROLES.includes(role as UserRole);
}

export function canManageClub(
  user: Profile | null,
  clubOrId: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;

  const clubId = typeof clubOrId === "string" ? clubOrId : clubOrId.id;
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  const isActiveForClub =
    typeof membership === "string" ||
    (!!membership && membership.club_id === clubId && membership.status === "active");

  if (!isActiveForClub || !membershipRole) return false;
  if (user.role === "teacher") return membershipRole === "sponsor";
  if (user.role !== "student") return false;
  return OFFICER_ROLES.includes(membershipRole as (typeof OFFICER_ROLES)[number]);
}

export function canApproveClubContent(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (user.role !== "teacher") return false;
  return canManageClub(user, club, membership);
}

export function canViewMemberContent(
  user: Profile | null,
  isMember: boolean
): boolean {
  if (!user) return false;
  return isMember;
}

export function canAccessAdmin(user: Profile | null): boolean {
  return !!user && isAdminRole(user.role);
}

export function canAccessManage(user: Profile | null): boolean {
  return !!user && isManagerRole(user.role);
}

export function canAccessManageAnalytics(user: Profile | null): boolean {
  return canAccessAdmin(user);
}

export function canApproveContent(user: Profile | null): boolean {
  return !!user && APPROVER_ROLES.includes(user.role);
}

export function canEditRole(
  actor: Profile | null,
  target: Profile,
  newRole: UserRole
): boolean {
  if (!actor || !isAdminRole(actor.role) || actor.id === target.id) return false;
  if (actor.role !== "super_admin") {
    if (!["student", "teacher"].includes(target.role)) return false;
    if (!["student", "teacher"].includes(newRole)) return false;
  }
  return true;
}

export function canDeleteUser(actor: Profile | null, target: Profile): boolean {
  if (!actor || !isAdminRole(actor.role) || actor.id === target.id) return false;
  if (actor.role !== "super_admin" && !["student", "teacher"].includes(target.role)) return false;
  return true;
}

export function canManageClubRoster(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return user.role === "teacher" && canManageClub(user, club, membership);
}

export function canCreateOpportunity(user: Profile | null): boolean {
  return canAccessAdmin(user);
}

export function canParticipate(user: Profile | null): boolean {
  return user?.role === "student";
}

export function isOfficerRole(role?: string): boolean {
  return !!role && OFFICER_ROLES.includes(role as (typeof OFFICER_ROLES)[number]);
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    student: "Student",
    teacher: "Teacher",
    admin: "Admin",
    super_admin: "Super Admin",
  };
  return labels[role] || role;
}
