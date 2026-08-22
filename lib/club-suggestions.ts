import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, School } from "@/types/database";

export interface SuggestableClub {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  short_description?: string | null;
  tags?: string[] | null;
  already_requested: boolean;
}

export async function getSuggestableClubCatalog(
  profile: Profile,
  school: School
): Promise<SuggestableClub[]> {
  if (!["student", "teacher"].includes(profile.role) || profile.school_id !== school.id) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const [
    { data: clubs, error: clubError },
    { data: suggestions, error: suggestionError },
    { data: customSuggestions, error: customSuggestionError },
  ] = await Promise.all([
    admin
      .from("clubs")
      .select("id,name,slug,category,short_description,tags")
      .eq("school_id", school.id)
      .eq("status", "draft")
      .eq("is_active", false)
      .eq("is_listed", false)
      .like("long_description", "This is a prepared StormHub template.%")
      .order("name"),
    admin
      .from("club_suggestions")
      .select("club_id")
      .eq("suggested_by", profile.id)
      .eq("status", "pending"),
    admin
      .from("club_suggestions")
      .select("club_id")
      .eq("school_id", school.id)
      .eq("source", "custom"),
  ]);
  if (clubError) {
    console.error("[getSuggestableClubCatalog]", clubError.message);
    return [];
  }
  if (suggestionError && suggestionError.code !== "42P01") {
    console.error("[getSuggestableClubCatalog suggestions]", suggestionError.message);
  }
  if (suggestionError?.code === "42P01" || customSuggestionError?.code === "42P01") return [];
  if (customSuggestionError && customSuggestionError.code !== "42P01") {
    console.error("[getSuggestableClubCatalog custom suggestions]", customSuggestionError.message);
  }
  const requestedIds = new Set((suggestions ?? []).map((item) => item.club_id));
  const customClubIds = new Set((customSuggestions ?? []).map((item) => item.club_id));
  return (clubs ?? []).filter((club) => !customClubIds.has(club.id)).map((club) => ({
    ...club,
    already_requested: requestedIds.has(club.id),
  })) as SuggestableClub[];
}
