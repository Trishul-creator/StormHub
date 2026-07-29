import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/mode";
import type { District, Profile, School } from "@/types/database";

function isDistrictSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01"
    || error.code === "PGRST205"
    || error.message?.includes("public.districts") === true;
}

export async function isDistrictSchemaAvailable(): Promise<boolean> {
  if (isDemoMode()) return true;
  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("districts").select("id").limit(1);
  return !error;
}

export async function getAllDistricts(): Promise<District[]> {
  if (isDemoMode()) {
    const { demoDistrict } = await import("@/lib/data/demo-data");
    return [demoDistrict];
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("districts")
    .select("*")
    .order("name");
  if (error) {
    if (!isDistrictSchemaMissing(error)) console.error("[getAllDistricts]", error.message);
    return [];
  }
  return (data as District[]) ?? [];
}

export async function getDistrictBySlug(slug: string): Promise<District | null> {
  if (!slug) return null;
  if (isDemoMode()) {
    const { demoDistrict } = await import("@/lib/data/demo-data");
    return demoDistrict.slug === slug ? demoDistrict : null;
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("districts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (!isDistrictSchemaMissing(error)) console.error("[getDistrictBySlug]", error.message);
    return null;
  }
  return data as District | null;
}

export async function getDistrictById(districtId: string | null | undefined): Promise<District | null> {
  if (!districtId) return null;
  if (isDemoMode()) {
    const { demoDistrict } = await import("@/lib/data/demo-data");
    return demoDistrict.id === districtId ? demoDistrict : null;
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("districts")
    .select("*")
    .eq("id", districtId)
    .maybeSingle();
  if (error) {
    if (!isDistrictSchemaMissing(error)) console.error("[getDistrictById]", error.message);
    return null;
  }
  return data as District | null;
}

export async function getDistrictForProfile(profile?: Profile | null): Promise<District | null> {
  if (!profile?.district_id || profile.role === "super_admin") return null;
  return getDistrictById(profile.district_id);
}

export async function getDistrictSchools(districtId: string): Promise<School[]> {
  if (!districtId) return [];
  if (isDemoMode()) {
    const { demoSchool } = await import("@/lib/data/demo-data");
    return demoSchool.district_id === districtId ? [demoSchool] : [];
  }

  const supabase = createAdminClient() ?? await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("district_id", districtId)
    .order("name");
  if (error) {
    console.error("[getDistrictSchools]", error.message);
    return [];
  }
  return (data as School[]) ?? [];
}
