import "server-only";

import { randomBytes, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

export interface SchoolSignupAccess {
  school_id: string;
  access_code: string;
  rotated_at: string;
}

export function generateSchoolSignupAccessCode(): string {
  const randomToken = randomBytes(6).toString("hex").toUpperCase();
  const token = `${randomToken.slice(0, 11)}${randomInt(10)}`;
  return `SH-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

export function normalizeSchoolSignupAccessCode(value: string): string {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

export function validateSchoolSignupAccessCode(value: string): string | null {
  const code = normalizeSchoolSignupAccessCode(value);
  if (code.length < 8 || code.length > 32) {
    return "Use 8 to 32 characters.";
  }
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) {
    return "Use only letters, numbers, and single hyphens between words.";
  }
  if (!/[A-Z]/.test(code) || !/[0-9]/.test(code)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

export function canManageSchoolAccess(
  actor: Profile,
  schoolId: string,
  schoolDistrictId?: string | null,
): boolean {
  return actor.role === "super_admin"
    || (
      actor.role === "district_admin"
      && !!schoolDistrictId
      && actor.district_id === schoolDistrictId
    )
    || (actor.role === "admin" && actor.school_id === schoolId);
}

export async function getSchoolSignupAccess(
  actor: Profile,
  schoolId: string,
  schoolDistrictId?: string | null,
): Promise<SchoolSignupAccess | null> {
  if (!canManageSchoolAccess(actor, schoolId, schoolDistrictId)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("school_signup_access")
    .select("school_id,access_code,rotated_at")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) {
    if (error.code !== "42P01") console.error("[getSchoolSignupAccess]", error.message);
    return null;
  }
  return data as SchoolSignupAccess | null;
}

export async function verifySchoolSignupAccessCode(
  schoolId: string,
  candidateCode: string
): Promise<{ configured: boolean; valid: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { configured: false, valid: false };
  const { data, error } = await admin.rpc("verify_school_signup_code", {
    target_school_id: schoolId,
    candidate_code: candidateCode,
  });
  if (error) {
    if (error.code !== "42883") {
      console.error("[verifySchoolSignupAccessCode]", error.message);
    }
    return { configured: false, valid: false };
  }
  return { configured: true, valid: data === true };
}
