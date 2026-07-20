import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/mode";
import type { Profile, School } from "@/types/database";

export const DEFAULT_SCHOOL_ID = "a0000000-0000-4000-8000-000000000001";
export const DEFAULT_SCHOOL_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG?.trim() || "elkhorn-south";
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL?.trim() || "stormhubsupport@gmail.com";

export function getDefaultSchoolSlug() {
  return DEFAULT_SCHOOL_SLUG;
}

export interface SchoolSettings {
  school_id: string;
  announcements_enabled: boolean;
  events_enabled: boolean;
  resources_enabled: boolean;
  opportunities_enabled: boolean;
  volunteering_enabled: boolean;
  workshops_enabled: boolean;
  email_sending_enabled: boolean;
}

export const defaultSchoolSettings = (schoolId: string): SchoolSettings => ({
  school_id: schoolId,
  announcements_enabled: true,
  events_enabled: true,
  resources_enabled: true,
  opportunities_enabled: true,
  volunteering_enabled: false,
  workshops_enabled: false,
  email_sending_enabled: true,
});

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  if (!slug) return null;
  if (isDemoMode()) {
    const { demoSchool } = await import("@/lib/data/demo-data");
    return demoSchool;
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[getSchoolBySlug]", error.message);
    return null;
  }
  return data as School | null;
}

export async function getSchoolById(schoolId: string | null | undefined): Promise<School | null> {
  if (!schoolId) return null;
  if (isDemoMode()) {
    const { demoSchool } = await import("@/lib/data/demo-data");
    return demoSchool;
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[getSchoolById]", error.message);
    return null;
  }
  return data as School | null;
}

export async function getDefaultSchool(): Promise<School | null> {
  return getSchoolBySlug(DEFAULT_SCHOOL_SLUG);
}

export async function getSchoolForProfile(profile?: Profile | null): Promise<School | null> {
  if (!profile) return null;
  if (profile.role === "super_admin") return null;
  return profile.school_id ? getSchoolById(profile.school_id) : null;
}

export async function requireUserSchool(profile: Profile): Promise<School> {
  const school = await getSchoolForProfile(profile);
  if (!school) {
    throw new Error("This account is not assigned to a school.");
  }
  return school;
}

export async function requireSchoolBySlug(slug: string): Promise<School> {
  const school = await getSchoolBySlug(slug);
  if (!school) {
    throw new Error("School not found.");
  }
  return school;
}

/**
 * Legacy fallback for old /clubs, /calendar, and /opportunities routes.
 * New code should use route/profile-specific helpers instead.
 */
export async function getCurrentSchool(profile?: Profile | null): Promise<School | null> {
  if (profile) return getSchoolForProfile(profile);
  return getDefaultSchool();
}

export function getSchoolWorkspaceUrl(school: Pick<School, "slug">) {
  return `/s/${school.slug}`;
}

export function getSchoolManageUrl(school: Pick<School, "slug">) {
  return `/admin/schools/${school.slug}`;
}

export function getSchoolPublicUrl(school: Pick<School, "slug">) {
  return `/s/${school.slug}`;
}

export async function getSchoolSettings(schoolId: string | null | undefined): Promise<SchoolSettings> {
  const resolvedSchoolId = schoolId || DEFAULT_SCHOOL_ID;
  if (isDemoMode()) return defaultSchoolSettings(resolvedSchoolId);

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return defaultSchoolSettings(resolvedSchoolId);

  const { data, error } = await supabase
    .from("school_settings")
    .select("*")
    .eq("school_id", resolvedSchoolId)
    .maybeSingle();

  if (error) {
    // The table is created by the optional multi-school patch. Older databases
    // should still run with safe feature defaults.
    return defaultSchoolSettings(resolvedSchoolId);
  }

  return data ? { ...defaultSchoolSettings(resolvedSchoolId), ...data } : defaultSchoolSettings(resolvedSchoolId);
}

export async function getAllSchools(): Promise<School[]> {
  if (isDemoMode()) {
    const { demoSchool } = await import("@/lib/data/demo-data");
    return [demoSchool];
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .order("name");

  if (error) {
    console.error("[getAllSchools]", error.message);
    return [];
  }
  return (data as School[]) ?? [];
}

export function getFilterableSchools(schools: School[], profile?: Profile | null): School[] {
  if (profile && profile.role !== "super_admin") {
    return schools.filter((school) => school.id === profile.school_id);
  }

  return schools.filter(
    (school) => school.is_active !== false && (profile?.role === "super_admin" || school.is_public !== false)
  );
}

export function selectSchoolFilter(
  schools: School[],
  requestedSlug?: string | null
): School | null {
  return (
    schools.find((school) => school.slug === requestedSlug) ??
    schools.find((school) => school.slug === DEFAULT_SCHOOL_SLUG) ??
    schools[0] ??
    null
  );
}

export async function getSchoolFilterContext(
  profile?: Profile | null,
  requestedSlug?: string | null
): Promise<{ schools: School[]; selectedSchool: School | null }> {
  const schools = getFilterableSchools(await getAllSchools(), profile);
  return { schools, selectedSchool: selectSchoolFilter(schools, requestedSlug) };
}
