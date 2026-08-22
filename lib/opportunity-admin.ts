import "server-only";

import { canCreateSchoolOpportunity } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, Profile, School } from "@/types/database";

export async function getManagedOpportunitiesForSchool(
  profile: Profile,
  school: School
): Promise<Opportunity[]> {
  if (!canCreateSchoolOpportunity(profile, school.id, school.district_id)) return [];
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("school_id", school.id);
  if (profile.role === "teacher") query = query.eq("author_id", profile.id);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("[getManagedOpportunitiesForSchool]", error.message);
    return [];
  }
  return (data ?? []) as Opportunity[];
}
