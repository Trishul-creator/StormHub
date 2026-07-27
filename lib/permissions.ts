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

export function isStudent(user: Profile | null | undefined): boolean {
  return user?.role === "student";
}

export function isTeacher(user: Profile | null | undefined): boolean {
  return user?.role === "teacher";
}

export function isSchoolAdmin(user: Profile | null | undefined): boolean {
  return user?.role === "admin";
}

export function isSuperAdmin(user: Profile | null | undefined): boolean {
  return user?.role === "super_admin";
}

export function isPlatformAdmin(user: Profile | null | undefined): boolean {
  return isSuperAdmin(user);
}

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
  if (user.role === "super_admin") return true;
  if (user.role === "admin" && typeof clubOrId !== "string") {
    return !!user.school_id && user.school_id === clubOrId.school_id;
  }
  if (user.role === "admin" && typeof clubOrId === "string") return true;

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

export function canManageClubPublication(
  user: Profile | null,
  club: Club
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.role === "admin" && !!user.school_id && user.school_id === club.school_id;
}

export function canApproveClubContent(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "admin" && typeof club !== "string") {
    return !!user.school_id && user.school_id === club.school_id;
  }
  if (user.role === "admin" && typeof club === "string") return true;
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

export function canAccessPlatformAdmin(user: Profile | null): boolean {
  return isSuperAdmin(user);
}

export function canAccessSchoolAdmin(user: Profile | null, schoolId?: string | null): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.role === "admin" && !!schoolId && user.school_id === schoolId;
}

export function canManageSchool(user: Profile | null, schoolId?: string | null): boolean {
  return canAccessSchoolAdmin(user, schoolId);
}

export function canViewSchool(user: Profile | null, schoolId?: string | null): boolean {
  if (!user || !schoolId) return false;
  if (user.role === "super_admin") return true;
  return user.school_id === schoolId;
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
    if (!actor.school_id || actor.school_id !== target.school_id) return false;
    if (!["student", "teacher"].includes(target.role)) return false;
    if (!["student", "teacher"].includes(newRole)) return false;
  }
  return true;
}

export function canDeleteUser(actor: Profile | null, target: Profile): boolean {
  if (!actor || !isAdminRole(actor.role) || actor.id === target.id) return false;
  if (actor.role !== "super_admin") {
    if (!actor.school_id || actor.school_id !== target.school_id) return false;
    if (!["student", "teacher"].includes(target.role)) return false;
  }
  return true;
}

export function getSponsorAssignableClubs(
  clubs: Club[],
  schoolId?: string | null
): Club[] {
  if (!schoolId) return [];

  const seenClubIds = new Set<string>();
  return clubs.filter((club) => {
    const isEligible =
      club.school_id === schoolId
      && club.is_active
      && club.is_listed
      && club.visibility === "public"
      && ["interest_open", "active"].includes(club.status);
    if (!isEligible || seenClubIds.has(club.id)) return false;
    seenClubIds.add(club.id);
    return true;
  });
}

export function canManageClubRoster(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  return user.role === "teacher" && canManageClub(user, club, membership);
}

export function canManageClubCoursework(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  return user.role === "teacher" && canManageClub(user, club, membership);
}

export function canCreateOpportunity(user: Profile | null): boolean {
  return canAccessAdmin(user);
}

export function canParticipate(user: Profile | null): boolean {
  return user?.role === "student";
}

export function canUseStudentFeatures(user: Profile | null, schoolId?: string | null): boolean {
  return user?.role === "student" && !!schoolId && user.school_id === schoolId;
}

export function canJoinClub(user: Profile | null, club: Club): boolean {
  return user?.role === "student" && !!user.school_id && user.school_id === club.school_id;
}

export function canCreateClub(user: Profile | null, schoolId?: string | null): boolean {
  if (!user || !schoolId) return false;
  return user.role === "super_admin" || (user.role === "admin" && user.school_id === schoolId);
}

export function canViewSchoolUsers(user: Profile | null, schoolId?: string | null): boolean {
  return canAccessSchoolAdmin(user, schoolId);
}

export function canEditSchoolSettings(user: Profile | null, schoolId?: string | null): boolean {
  return canAccessSchoolAdmin(user, schoolId);
}

export function canSendSchoolEmail(user: Profile | null, schoolId?: string | null): boolean {
  return canAccessSchoolAdmin(user, schoolId);
}

export function canViewSchoolEmailLog(user: Profile | null, schoolId?: string | null): boolean {
  return canAccessSchoolAdmin(user, schoolId);
}

export function isOfficerRole(role?: string): boolean {
  return !!role && OFFICER_ROLES.includes(role as (typeof OFFICER_ROLES)[number]);
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    student: "Student",
    teacher: "Teacher/Sponsor",
    admin: "School Admin",
    super_admin: "Platform Admin",
  };
  return labels[role] || role;
}
