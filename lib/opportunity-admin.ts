import "server-only";

import { canAccessSchoolAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, Profile, School } from "@/types/database";

export async function getManagedOpportunitiesForSchool(
  profile: Profile,
  school: School
): Promise<Opportunity[]> {
  if (!canAccessSchoolAdmin(profile, school.id, school.district_id)) return [];
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getManagedOpportunitiesForSchool]", error.message);
    return [];
  }
  return (data ?? []) as Opportunity[];
}
