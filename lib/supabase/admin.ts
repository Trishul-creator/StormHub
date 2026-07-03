import { createClient } from "@supabase/supabase-js";
import { maybeGetSupabaseServiceRoleKey, maybeGetSupabaseUrl } from "@/lib/env";

export function createAdminClient() {
  const url = maybeGetSupabaseUrl();
  const key = maybeGetSupabaseServiceRoleKey();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
