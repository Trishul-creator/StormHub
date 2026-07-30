import "server-only";

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
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("districts").select("id").limit(1);
  return !error;
}

export async function getAllDistricts(): Promise<District[]> {
  if (isDemoMode()) {
    const { demoDistrict } = await import("@/lib/data/demo-data");
    return [demoDistrict];
  }

  const supabase = await createClient();
  if (!supabase) return [];

  const districts: District[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .order("name")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (!isDistrictSchemaMissing(error)) console.error("[getAllDistricts]", error.message);
      return [];
    }
    districts.push(...((data as District[] | null) ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return districts;
}

export async function getDistrictBySlug(slug: string): Promise<District | null> {
  if (!slug) return null;
  if (isDemoMode()) {
    const { demoDistrict } = await import("@/lib/data/demo-data");
    return demoDistrict.slug === slug ? demoDistrict : null;
  }

  const supabase = await createClient();
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

  const supabase = await createClient();
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

  const supabase = await createClient();
  if (!supabase) return [];

  const schools: School[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("district_id", districtId)
      .order("name")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("[getDistrictSchools]", error.message);
      return [];
    }
    schools.push(...((data as School[] | null) ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return schools;
}
