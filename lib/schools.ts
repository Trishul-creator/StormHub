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

export async function getSchoolBySlug(slug = DEFAULT_SCHOOL_SLUG): Promise<School | null> {
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
  if (!schoolId) return getSchoolBySlug();
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

export async function getCurrentSchool(profile?: Profile | null): Promise<School | null> {
  return profile?.school_id ? getSchoolById(profile.school_id) : getSchoolBySlug();
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
