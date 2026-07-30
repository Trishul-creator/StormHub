import "server-only";

import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
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

  const supabase = await createClient();
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
  const schools = await getSignupSchools();
  return schools.find((school) => school.slug === DEFAULT_SCHOOL_SLUG) ?? schools[0] ?? null;
}

export async function getPublicDemoSchool(): Promise<School> {
  const { demoSchool } = await import("@/lib/data/demo-data");
  return demoSchool;
}

export function canProfileViewSchool(
  profile: Profile | null | undefined,
  school: Pick<School, "id" | "district_id">
): boolean {
  if (!profile || (profile.account_status && profile.account_status !== "active")) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "district_admin") {
    return Boolean(
      profile.district_id
      && school.district_id
      && profile.district_id === school.district_id
    );
  }
  return Boolean(profile.school_id && profile.school_id === school.id);
}

export async function getSchoolBySlugForViewer(
  slug: string,
  profile?: Profile | null
): Promise<School | null> {
  if (!profile) return getPublicDemoSchool();
  const school = await getSchoolBySlug(slug);
  return school && canProfileViewSchool(profile, school) ? school : null;
}

export async function getSchoolByIdForViewer(
  schoolId: string | null | undefined,
  profile?: Profile | null
): Promise<School | null> {
  if (!profile) return getPublicDemoSchool();
  const school = await getSchoolById(schoolId);
  return school && canProfileViewSchool(profile, school) ? school : null;
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

  const supabase = await createClient();
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

  const supabase = await createClient();
  if (!supabase) return [];

  const schools: School[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .order("name")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("[getAllSchools]", error.message);
      return [];
    }
    schools.push(...((data as School[] | null) ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return schools;
}

/**
 * Returns only the public fields needed to choose a school during signup.
 * The database RPC intentionally excludes domains, addresses, configuration,
 * access codes, and administrative metadata.
 */
export async function getSignupSchools(search?: string | null): Promise<School[]> {
  if (isDemoMode()) {
    const { demoSchool } = await import("@/lib/data/demo-data");
    return [demoSchool];
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const schools: School[] = [];
  const pageSize = 250;
  const normalizedSearch = search?.trim().slice(0, 100) || null;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.rpc("list_signup_schools", {
      page_offset: offset,
      page_limit: pageSize,
      search_text: normalizedSearch,
    });
    if (error) {
      console.error("[getSignupSchools]", error.message);
      return [];
    }
    schools.push(...((data as School[] | null) ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return schools;
}

/**
 * Administrative selectors include inactive and private schools because
 * account support, offboarding, and historical records remain necessary
 * after a school is no longer publicly discoverable.
 */
export function getAdminScopeSchools(schools: School[], profile: Profile): School[] {
  if (profile.role === "super_admin") return schools;
  if (profile.role === "district_admin") {
    return schools.filter((school) =>
      Boolean(profile.district_id && school.district_id === profile.district_id)
    );
  }
  if (profile.role === "admin") {
    return schools.filter((school) => school.id === profile.school_id);
  }
  return [];
}

export function getFilterableSchools(schools: School[], profile?: Profile | null): School[] {
  if (profile?.role === "district_admin") {
    return schools.filter(
      (school) =>
        school.district_id === profile.district_id
        && school.is_active !== false
        && school.is_public !== false
    );
  }
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
  if (!profile) {
    const demoSchool = await getPublicDemoSchool();
    return { schools: [demoSchool], selectedSchool: demoSchool };
  }
  const schools = getFilterableSchools(await getAllSchools(), profile);
  return { schools, selectedSchool: selectSchoolFilter(schools, requestedSlug) };
}
