import { isSupabaseConfigured } from "./client";

/** True when Supabase env vars are missing or demo mode is forced. */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  return !isSupabaseConfigured();
}

export function isSupabaseMode(): boolean {
  return isSupabaseConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
}
