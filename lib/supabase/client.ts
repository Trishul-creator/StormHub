import { createBrowserClient } from "@supabase/ssr";
import { maybeGetSupabaseAnonKey, maybeGetSupabaseUrl } from "@/lib/env";

export function isSupabaseConfigured(): boolean {
  return Boolean(maybeGetSupabaseUrl() && maybeGetSupabaseAnonKey());
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createBrowserClient(maybeGetSupabaseUrl()!, maybeGetSupabaseAnonKey()!);
}
