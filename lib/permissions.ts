import type {
  Club,
  ClubMembership,
  MembershipRole,
  Profile,
  UserRole,
} from "@/types/database";

const CLUB_LEADER_ROLES: MembershipRole[] = ["officer", "president", "sponsor"];

const ADMIN_ROLES: UserRole[] = ["admin", "district_admin", "super_admin"];
const MANAGER_ROLES: UserRole[] = ["teacher", "admin", "super_admin"];
const APPROVER_ROLES: UserRole[] = ["teacher", "admin", "district_admin"];

export function isStudent(user: Profile | null | undefined): boolean {
  return user?.role === "student";
}

export function isTeacher(user: Profile | null | undefined): boolean {
  return user?.role === "teacher";
}

export function isSchoolAdmin(user: Profile | null | undefined): boolean {
  return user?.role === "admin";
}

export function isDistrictAdmin(user: Profile | null | undefined): boolean {
  return user?.role === "district_admin";
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

export function canOpenUserEditor(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (targetRole === "district_admin" || targetRole === "super_admin") return false;
  if (actorRole === "admin") return targetRole === "student" || targetRole === "teacher";
  if (actorRole === "district_admin" || actorRole === "super_admin") {
    return ["student", "teacher", "admin"].includes(targetRole);
  }
  return false;
}

export function canManageUserAccountFromInventory(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (targetRole === "district_admin" || targetRole === "super_admin") return false;
  if (actorRole === "admin") {
    return targetRole === "student" || targetRole === "teacher";
  }
  return actorRole === "district_admin" || actorRole === "super_admin";
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
  if (user.role === "super_admin") return false;
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
  return membershipRole === "officer" || membershipRole === "president";
}

export function canManageClubPublication(
  user: Profile | null,
  club: Club
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return false;
  return user.role === "admin" && !!user.school_id && user.school_id === club.school_id;
}

export function canApproveClubContent(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return false;
  if (user.role === "admin" && typeof club !== "string") {
    return !!user.school_id && user.school_id === club.school_id;
  }
  if (user.role === "admin" && typeof club === "string") return true;
  if (user.role !== "teacher") return false;
  return canManageClub(user, club, membership);
}

export function canPublishClubContent(
  user: Profile | null,
  club: Club | string,
  membership: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null | undefined,
  contentType: "announcement" | "event" | "resource"
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return false;
  if (user.role === "admin") {
    return typeof club === "string" || (!!user.school_id && user.school_id === club.school_id);
  }
  if (!canManageClub(user, club, membership)) return false;
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  if (user.role === "teacher") return membershipRole === "sponsor";
  if (user.role !== "student" || membershipRole !== "president") return false;
  return contentType !== "event";
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

export function canAccessDistrictAdmin(user: Profile | null, districtId?: string | null): boolean {
  if (!user || !districtId) return false;
  return user.role === "super_admin"
    || (user.role === "district_admin" && user.district_id === districtId);
}

export function canAccessSchoolAdmin(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "district_admin") {
    return !!schoolDistrictId && user.district_id === schoolDistrictId;
  }
  return user.role === "admin" && !!schoolId && user.school_id === schoolId;
}

export function canManageSchool(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null
): boolean {
  return canAccessSchoolAdmin(user, schoolId, schoolDistrictId);
}

export function canViewSchool(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null
): boolean {
  if (!user || !schoolId) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "district_admin") {
    return !!schoolDistrictId && user.district_id === schoolDistrictId;
  }
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
  if (
    ["district_admin", "super_admin"].includes(target.role)
    || ["district_admin", "super_admin"].includes(newRole)
  ) {
    return false;
  }
  if (actor.role === "district_admin") {
    return !!actor.district_id
      && actor.district_id === target.district_id
      && ["student", "teacher", "admin"].includes(target.role)
      && ["student", "teacher", "admin"].includes(newRole);
  }
  if (actor.role !== "super_admin") {
    if (!actor.school_id || actor.school_id !== target.school_id) return false;
    if (!["student", "teacher"].includes(target.role)) return false;
    if (!["student", "teacher"].includes(newRole)) return false;
  }
  return true;
}

export function canDeleteUser(actor: Profile | null, target: Profile): boolean {
  if (!actor || !isAdminRole(actor.role) || actor.id === target.id) return false;
  if (["district_admin", "super_admin"].includes(target.role)) return false;
  if (actor.role === "district_admin") {
    return !!actor.district_id
      && actor.district_id === target.district_id
      && ["student", "teacher", "admin"].includes(target.role);
  }
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
  if (user.role === "super_admin") return false;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  if (!canManageClub(user, club, membership)) return false;
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  return (
    (user.role === "teacher" && membershipRole === "sponsor")
    || (user.role === "student" && membershipRole === "officer")
  );
}

export function canAssignClubLeadership(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return false;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  return user.role === "teacher"
    && membershipRole === "sponsor"
    && canManageClub(user, club, membership);
}

export function canBanClubMember(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  return canAssignClubLeadership(user, club, membership);
}

export function canCreateClubCoursework(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  return canManageClub(user, club, membership);
}

export function canPublishClubCoursework(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return false;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  if (!canManageClub(user, club, membership)) return false;
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  return (
    (user.role === "teacher" && membershipRole === "sponsor")
    || (user.role === "student" && membershipRole === "president")
  );
}

export function canGradeClubCoursework(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user || user.role === "super_admin") return false;
  if (user.role === "admin") {
    return typeof club !== "string" && !!user.school_id && user.school_id === club.school_id;
  }
  const membershipRole = typeof membership === "string" ? membership : membership?.role;
  return user.role === "teacher"
    && membershipRole === "sponsor"
    && canManageClub(user, club, membership);
}

export function canInspectClubCoursework(
  user: Profile | null,
  club: Club,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null,
  hasActivePlatformSupportAccess = false
): boolean {
  return canGradeClubCoursework(user, club, membership)
    || (user?.role === "super_admin" && hasActivePlatformSupportAccess);
}

export function canTrackClubSubmissions(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  return canCreateClubCoursework(user, club, membership);
}

/** Compatibility name for existing callers that need assignment workspace access. */
export function canManageClubCoursework(
  user: Profile | null,
  club: Club | string,
  membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  return canCreateClubCoursework(user, club, membership);
}

export function canArchiveClub(
  user: Profile | null,
  club: Club | string,
  _membership?: Pick<ClubMembership, "club_id" | "status" | "role"> | string | null
): boolean {
  if (!user || user.role !== "admin" || !user.school_id) return false;
  return typeof club !== "string" && user.school_id === club.school_id;
}

export function canCreateOpportunity(user: Profile | null): boolean {
  return user?.role === "admin" || user?.role === "district_admin";
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

export function canCreateClub(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null
): boolean {
  if (!user || !schoolId) return false;
  return (user.role === "district_admin"
      && !!schoolDistrictId
      && user.district_id === schoolDistrictId)
    || (user.role === "admin" && user.school_id === schoolId);
}

export function canViewSchoolUsers(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null,
): boolean {
  return canAccessSchoolAdmin(user, schoolId, schoolDistrictId);
}

export function canEditSchoolSettings(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null,
): boolean {
  return canAccessSchoolAdmin(user, schoolId, schoolDistrictId);
}

export function canSendSchoolEmail(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null,
): boolean {
  return canAccessSchoolAdmin(user, schoolId, schoolDistrictId);
}

export function canViewSchoolEmailLog(
  user: Profile | null,
  schoolId?: string | null,
  schoolDistrictId?: string | null,
): boolean {
  return canAccessSchoolAdmin(user, schoolId, schoolDistrictId);
}

export function isOfficerRole(role?: string): boolean {
  return !!role && CLUB_LEADER_ROLES.includes(role as MembershipRole);
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    student: "Student",
    teacher: "Teacher/Advisor",
    admin: "School Admin",
    district_admin: "District Admin",
    super_admin: "Platform Admin",
  };
  return labels[role] || role;
}
