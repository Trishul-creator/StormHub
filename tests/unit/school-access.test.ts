import { describe, expect, it } from "vitest";
import {
  canManageSchoolAccess,
  generateSchoolSignupAccessCode,
  normalizeSchoolSignupAccessCode,
  validateSchoolSignupAccessCode,
} from "@/lib/school-access";
import type { Profile } from "@/types/database";

function profile(
  role: Profile["role"],
  schoolId: string | null,
  districtId: string | null = null,
): Profile {
  return {
    id: `${role}-1`,
    role,
    school_id: schoolId,
    district_id: districtId,
    account_status: "active",
  };
}

describe("school signup access", () => {
  it("generates strong readable school codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateSchoolSignupAccessCode()));
    expect(codes.size).toBe(20);
    for (const code of codes) {
      expect(code).toMatch(/^SH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    }
  });

  it("limits code management to the school's admin and platform admins", () => {
    expect(canManageSchoolAccess(profile("admin", "school-a"), "school-a")).toBe(true);
    expect(canManageSchoolAccess(profile("admin", "school-a"), "school-b")).toBe(false);
    expect(canManageSchoolAccess(profile("super_admin", null), "school-b")).toBe(true);
    expect(
      canManageSchoolAccess(
        profile("district_admin", null, "district-a"),
        "school-b",
        "district-a",
      ),
    ).toBe(true);
    expect(
      canManageSchoolAccess(
        profile("district_admin", null, "district-a"),
        "school-b",
        "district-b",
      ),
    ).toBe(false);
    expect(canManageSchoolAccess(profile("teacher", "school-a"), "school-a")).toBe(false);
    expect(canManageSchoolAccess(profile("student", "school-a"), "school-a")).toBe(false);
  });

  it("normalizes and validates custom school codes", () => {
    expect(normalizeSchoolSignupAccessCode("  eagles 2026 ")).toBe("EAGLES-2026");
    expect(validateSchoolSignupAccessCode("EAGLES-2026")).toBeNull();
    expect(validateSchoolSignupAccessCode("ONLYLETTERS")).toMatch(/number/i);
    expect(validateSchoolSignupAccessCode("12345678")).toMatch(/letter/i);
    expect(validateSchoolSignupAccessCode("BAD--CODE1")).toMatch(/single hyphens/i);
    expect(validateSchoolSignupAccessCode("A1")).toMatch(/8 to 32/i);
  });
});
