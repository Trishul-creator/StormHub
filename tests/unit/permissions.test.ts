import { describe, expect, it } from "vitest";
import {
  canAccessSchoolAdmin,
  canAccessDistrictAdmin,
  canCreateClub,
  canDeleteUser,
  canEditRole,
  canJoinClub,
  canManageClub,
  canManageClubPublication,
  canManageClubCoursework,
  canManageClubRoster,
  canManageUserAccountFromInventory,
  canAssignClubLeadership,
  canGradeClubCoursework,
  canInspectClubCoursework,
  canPublishClubCoursework,
  canManageSchool,
  canOpenUserEditor,
  canUseStudentFeatures,
  canViewMemberContent,
  getSponsorAssignableClubs,
  isPlatformAdmin,
  isDistrictAdmin,
  isSchoolAdmin,
  isStudent,
  isSuperAdmin,
  isTeacher,
} from "@/lib/permissions";
import type { Club, ClubMembership, Profile } from "@/types/database";

const schoolA = "school-a";
const schoolB = "school-b";

function profile(role: Profile["role"], overrides: Partial<Profile> = {}): Profile {
  return {
    id: `${role}-id`,
    email: `${role}@example.test`,
    full_name: role,
    role,
    school_id: role === "super_admin" ? null : schoolA,
    grade_level: null,
    avatar_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: "club-a",
    school_id: schoolA,
    name: "Science Bowl",
    slug: "science-bowl",
    short_description: "Science competition",
    long_description: null,
    category: "STEM",
    tags: [],
    meeting_time: null,
    meeting_location: null,
    sponsor_name: null,
    sponsor_email: null,
    join_instructions: null,
    is_active: true,
    is_featured: false,
    is_listed: true,
    status: "interest_open",
    visibility: "public",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function membership(role: ClubMembership["role"], clubId = "club-a"): Pick<ClubMembership, "club_id" | "status" | "role"> {
  return { club_id: clubId, status: "active", role };
}

describe("global role helpers", () => {
  it("classifies global roles without treating admins as students", () => {
    expect(isStudent(profile("student"))).toBe(true);
    expect(isTeacher(profile("teacher"))).toBe(true);
    expect(isSchoolAdmin(profile("admin"))).toBe(true);
    expect(isSuperAdmin(profile("super_admin"))).toBe(true);
    expect(isDistrictAdmin(profile("district_admin"))).toBe(true);
    expect(isPlatformAdmin(profile("super_admin"))).toBe(true);
    expect(isSuperAdmin(profile("admin"))).toBe(false);
    expect(isStudent(profile("super_admin"))).toBe(false);
  });
});

describe("student feature permissions", () => {
  it("allows students to use student features only in their own school", () => {
    const student = profile("student", { school_id: schoolA });
    expect(canUseStudentFeatures(student, schoolA)).toBe(true);
    expect(canUseStudentFeatures(student, schoolB)).toBe(false);
  });

  it("does not allow admins, super admins, or teachers to use student join flow", () => {
    const targetClub = club();
    expect(canJoinClub(profile("admin"), targetClub)).toBe(false);
    expect(canJoinClub(profile("super_admin"), targetClub)).toBe(false);
    expect(canJoinClub(profile("teacher"), targetClub)).toBe(false);
  });

  it("allows student club join only for the student's own school", () => {
    expect(canJoinClub(profile("student", { school_id: schoolA }), club({ school_id: schoolA }))).toBe(true);
    expect(canJoinClub(profile("student", { school_id: schoolA }), club({ school_id: schoolB }))).toBe(false);
  });
});

describe("school admin permissions", () => {
  it("allows school admins to manage only their own school", () => {
    const admin = profile("admin", { school_id: schoolA });
    expect(canManageSchool(admin, schoolA)).toBe(true);
    expect(canAccessSchoolAdmin(admin, schoolA)).toBe(true);
    expect(canManageSchool(admin, schoolB)).toBe(false);
  });

  it("allows super admins to manage any school", () => {
    const superAdmin = profile("super_admin");
    expect(canManageSchool(superAdmin, schoolA)).toBe(true);
    expect(canManageSchool(superAdmin, schoolB)).toBe(true);
  });

  it("limits district administrators to schools in their district", () => {
    const districtAdmin = profile("district_admin", {
      school_id: null,
      district_id: "district-a",
    });
    expect(canAccessDistrictAdmin(districtAdmin, "district-a")).toBe(true);
    expect(canAccessDistrictAdmin(districtAdmin, "district-b")).toBe(false);
    expect(canAccessSchoolAdmin(districtAdmin, schoolA, "district-a")).toBe(true);
    expect(canAccessSchoolAdmin(districtAdmin, schoolB, "district-b")).toBe(false);
    expect(
      canEditRole(
        districtAdmin,
        profile("admin", { school_id: schoolA, district_id: "district-a" }),
        "teacher",
      ),
    ).toBe(true);
    expect(
      canEditRole(
        districtAdmin,
        profile("admin", { school_id: schoolB, district_id: "district-b" }),
        "teacher",
      ),
    ).toBe(false);
  });

  it("does not allow students or teachers to manage a whole school", () => {
    expect(canManageSchool(profile("student"), schoolA)).toBe(false);
    expect(canManageSchool(profile("teacher"), schoolA)).toBe(false);
  });

  it("allows school admins to edit only student and teacher roles in their own school", () => {
    const admin = profile("admin", { school_id: schoolA });
    expect(canEditRole(admin, profile("student", { school_id: schoolA }), "teacher")).toBe(true);
    expect(canEditRole(admin, profile("teacher", { school_id: schoolA }), "student")).toBe(true);
    expect(canEditRole(admin, profile("student", { school_id: schoolB }), "teacher")).toBe(false);
    expect(canEditRole(admin, profile("admin", { school_id: schoolA }), "teacher")).toBe(false);
    expect(canEditRole(admin, profile("student", { school_id: schoolA }), "admin")).toBe(false);
  });

  it("allows school admins to delete only student and teacher accounts in their own school", () => {
    const admin = profile("admin", { school_id: schoolA });
    expect(canDeleteUser(admin, profile("student", { school_id: schoolA }))).toBe(true);
    expect(canDeleteUser(admin, profile("teacher", { school_id: schoolA }))).toBe(true);
    expect(canDeleteUser(admin, profile("student", { school_id: schoolB }))).toBe(false);
    expect(canDeleteUser(admin, profile("admin", { school_id: schoolA }))).toBe(false);
  });

  it("allows super admins to edit and delete across schools", () => {
    const superAdmin = profile("super_admin");
    expect(canEditRole(superAdmin, profile("admin", { school_id: schoolB }), "teacher")).toBe(true);
    expect(canDeleteUser(superAdmin, profile("teacher", { school_id: schoolB }))).toBe(true);
  });

  it("keeps elevated account assignment and removal out of generic user management", () => {
    const superAdmin = profile("super_admin");
    const districtAdmin = profile("district_admin", {
      district_id: "district-a",
      school_id: null,
    });
    const otherSuperAdmin = profile("super_admin", { id: "super-admin-2" });
    const schoolAdmin = profile("admin", { school_id: schoolA });

    expect(canEditRole(superAdmin, districtAdmin, "admin")).toBe(false);
    expect(canEditRole(superAdmin, otherSuperAdmin, "admin")).toBe(false);
    expect(canDeleteUser(superAdmin, districtAdmin)).toBe(false);
    expect(canDeleteUser(superAdmin, otherSuperAdmin)).toBe(false);
    expect(canEditRole(superAdmin, schoolAdmin, "district_admin")).toBe(false);
    expect(canEditRole(superAdmin, schoolAdmin, "super_admin")).toBe(false);
  });

  it("offers sponsors one copy of each published, active club in their school", () => {
    const publishedClub = club();
    const choices = getSponsorAssignableClubs([
      publishedClub,
      { ...publishedClub },
      club({ id: "other-school", slug: "other-school", school_id: schoolB }),
      club({ id: "draft", slug: "draft", status: "draft", is_active: false, is_listed: false }),
      club({ id: "paused", slug: "paused", status: "paused", is_active: false }),
      club({ id: "private", slug: "private", visibility: "private" }),
      club({ id: "unlisted", slug: "unlisted", is_listed: false }),
    ], schoolA);

    expect(choices.map((choice) => choice.id)).toEqual([publishedClub.id]);
    expect(getSponsorAssignableClubs([publishedClub], null)).toEqual([]);
  });
});

describe("administrative inventory editing", () => {
  it("allows aggregate school-level editing while keeping elevated rows read-only", () => {
    expect(canOpenUserEditor("super_admin", "teacher")).toBe(true);
    expect(canOpenUserEditor("district_admin", "admin")).toBe(true);
    expect(canOpenUserEditor("super_admin", "district_admin")).toBe(false);
    expect(canOpenUserEditor("super_admin", "super_admin")).toBe(false);
  });

  it("allows only supported targets to open the editor", () => {
    expect(canOpenUserEditor("super_admin", "teacher")).toBe(true);
    expect(canOpenUserEditor("district_admin", "admin")).toBe(true);
    expect(canOpenUserEditor("admin", "student")).toBe(true);
    expect(canOpenUserEditor("admin", "admin")).toBe(false);
  });

  it("keeps aggregate account actions scoped without exposing elevated accounts", () => {
    expect(canManageUserAccountFromInventory("super_admin", "student")).toBe(true);
    expect(canManageUserAccountFromInventory("super_admin", "admin")).toBe(true);
    expect(canManageUserAccountFromInventory("district_admin", "teacher")).toBe(true);
    expect(canManageUserAccountFromInventory("district_admin", "admin")).toBe(true);
    expect(canManageUserAccountFromInventory("admin", "student")).toBe(true);
    expect(canManageUserAccountFromInventory("admin", "admin")).toBe(false);
    expect(canManageUserAccountFromInventory("super_admin", "district_admin")).toBe(false);
    expect(canManageUserAccountFromInventory("super_admin", "super_admin")).toBe(false);
  });
});

describe("club permissions", () => {
  it("allows members to view member-only portal only when they are members", () => {
    expect(canViewMemberContent(profile("student"), true)).toBe(true);
    expect(canViewMemberContent(profile("student"), false)).toBe(false);
    expect(canViewMemberContent(null, true)).toBe(false);
  });

  it("allows officers and presidents to manage their own active club only", () => {
    const student = profile("student");
    expect(canManageClub(student, club({ id: "club-a" }), membership("officer", "club-a"))).toBe(true);
    expect(canManageClub(student, club({ id: "club-a" }), membership("president", "club-a"))).toBe(true);
    expect(canManageClub(student, club({ id: "club-b" }), membership("officer", "club-a"))).toBe(false);
    expect(canManageClub(student, club({ id: "club-a" }), membership("member", "club-a"))).toBe(false);
  });

  it("allows teacher sponsors to manage sponsored clubs only", () => {
    const teacher = profile("teacher");
    expect(canManageClub(teacher, club({ id: "club-a" }), membership("sponsor", "club-a"))).toBe(true);
    expect(canManageClub(teacher, club({ id: "club-b" }), membership("sponsor", "club-a"))).toBe(false);
  });

  it("allows school admins only for clubs in their school and keeps platform support read-only", () => {
    expect(canManageClub(profile("admin", { school_id: schoolA }), club({ school_id: schoolA }))).toBe(true);
    expect(canManageClub(profile("admin", { school_id: schoolA }), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClub(profile("super_admin"), club({ school_id: schoolB }))).toBe(false);
  });

  it("lets Vice Presidents coordinate general members while reserving leadership changes for adults", () => {
    expect(canManageClubRoster(profile("admin", { school_id: schoolA }), club({ school_id: schoolA }))).toBe(true);
    expect(canManageClubRoster(profile("admin", { school_id: schoolA }), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClubRoster(profile("super_admin"), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClubRoster(profile("teacher"), club(), membership("sponsor"))).toBe(true);
    expect(canManageClubRoster(profile("student"), club(), membership("president"))).toBe(false);
    expect(canManageClubRoster(profile("student"), club(), membership("officer"))).toBe(true);
    expect(canAssignClubLeadership(profile("student"), club(), membership("officer"))).toBe(false);
    expect(canAssignClubLeadership(profile("teacher"), club(), membership("sponsor"))).toBe(true);
  });

  it("separates assignment creation, publishing, and grading permissions", () => {
    expect(canManageClubCoursework(profile("admin", { school_id: schoolA }), club({ school_id: schoolA }))).toBe(true);
    expect(canManageClubCoursework(profile("admin", { school_id: schoolA }), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClubCoursework(profile("super_admin"), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClubCoursework(profile("teacher"), club(), membership("sponsor"))).toBe(true);
    expect(canManageClubCoursework(profile("teacher"), club(), membership("member"))).toBe(false);
    expect(canManageClubCoursework(profile("student"), club(), membership("president"))).toBe(true);
    expect(canManageClubCoursework(profile("student"), club(), membership("officer"))).toBe(true);
    expect(canPublishClubCoursework(profile("student"), club(), membership("president"))).toBe(true);
    expect(canPublishClubCoursework(profile("student"), club(), membership("officer"))).toBe(false);
    expect(canPublishClubCoursework(profile("super_admin"), club())).toBe(false);
    expect(canGradeClubCoursework(profile("student"), club(), membership("president"))).toBe(false);
    expect(canGradeClubCoursework(profile("teacher"), club(), membership("sponsor"))).toBe(true);
    expect(canGradeClubCoursework(profile("super_admin"), club())).toBe(false);
    expect(canInspectClubCoursework(profile("super_admin"), club(), null, false)).toBe(false);
    expect(canInspectClubCoursework(profile("super_admin"), club(), null, true)).toBe(true);
  });

  it("allows only scoped admins to publish or feature clubs", () => {
    expect(canManageClubPublication(profile("teacher"), club())).toBe(false);
    expect(canManageClubPublication(profile("student"), club())).toBe(false);
    expect(canManageClubPublication(profile("admin", { school_id: schoolA }), club({ school_id: schoolA }))).toBe(true);
    expect(canManageClubPublication(profile("admin", { school_id: schoolA }), club({ school_id: schoolB }))).toBe(false);
    expect(canManageClubPublication(profile("super_admin"), club({ school_id: schoolB }))).toBe(false);
  });

  it("allows school admins to manage while keeping platform support read-only and out of student flows", () => {
    const targetClub = club();
    expect(canManageClub(profile("admin"), targetClub)).toBe(true);
    expect(canManageClub(profile("super_admin"), targetClub)).toBe(false);
    expect(canJoinClub(profile("admin"), targetClub)).toBe(false);
    expect(canJoinClub(profile("super_admin"), targetClub)).toBe(false);
  });
});

describe("opportunity-style school scoping expectations", () => {
  it("uses student feature and admin-school helpers for opportunity boundaries", () => {
    expect(canUseStudentFeatures(profile("student", { school_id: schoolA }), schoolA)).toBe(true);
    expect(canUseStudentFeatures(profile("student", { school_id: schoolA }), schoolB)).toBe(false);
    expect(canAccessSchoolAdmin(profile("admin", { school_id: schoolA }), schoolA)).toBe(true);
    expect(canAccessSchoolAdmin(profile("admin", { school_id: schoolA }), schoolB)).toBe(false);
    expect(canAccessSchoolAdmin(profile("super_admin"), schoolB)).toBe(true);
  });

  it("allows only scoped school or district admins to create draft clubs", () => {
    expect(canCreateClub(profile("admin", { school_id: schoolA }), schoolA)).toBe(true);
    expect(canCreateClub(profile("admin", { school_id: schoolA }), schoolB)).toBe(false);
    expect(canCreateClub(profile("super_admin"), schoolB)).toBe(false);
    expect(canCreateClub(
      profile("district_admin", { district_id: "district-a" }),
      schoolB,
      "district-a",
    )).toBe(true);
    expect(canCreateClub(
      profile("district_admin", { district_id: "district-a" }),
      schoolB,
      "district-b",
    )).toBe(false);
    expect(canCreateClub(profile("teacher"), schoolA)).toBe(false);
  });
});
