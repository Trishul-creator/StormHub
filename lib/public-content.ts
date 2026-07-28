import type { Profile } from "@/types/database";

/**
 * Anonymous visitors receive the fictional showcase catalog. Real school
 * records are reserved for authenticated accounts and remain school-scoped.
 */
export function shouldServePublicDemoContent(
  profile: Pick<Profile, "id"> | null | undefined,
  demoMode: boolean
): boolean {
  return demoMode || !profile;
}
