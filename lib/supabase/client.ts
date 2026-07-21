import { createBrowserClient } from "@supabase/ssr";

function getBrowserConfig() {
  // Next.js only exposes NEXT_PUBLIC variables to browser bundles when they are
  // referenced directly. Reading them through a dynamic process.env object
  // leaves client-side auth incorrectly reporting that Supabase is unavailable.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getBrowserConfig();
  return Boolean(url && anonKey);
}

export function createClient() {
  const { url, anonKey } = getBrowserConfig();
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
