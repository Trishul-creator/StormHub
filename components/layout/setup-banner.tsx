import { isDemoMode, isSupabaseMode } from "@/lib/supabase/mode";
import { createAdminClient } from "@/lib/supabase/admin";

export async function SetupBanner() {
  if (!isSupabaseMode()) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { error } = await admin
    .from("schools")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  if (!error) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
      Supabase is connected, but database tables are missing or incomplete. Apply{" "}
      <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase/schema.sql</code>,{" "}
      <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase/policies.sql</code>, and the documented patches.
    </div>
  );
}

export function SetupRequiredMessage() {
  if (isDemoMode()) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
      <strong>Database setup needed.</strong> Open your Supabase SQL Editor and apply{" "}
      <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase/schema.sql</code>,{" "}
      <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase/policies.sql</code>, and the documented patches.
    </div>
  );
}
