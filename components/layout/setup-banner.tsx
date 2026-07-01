import { isDemoMode, isSupabaseMode } from "@/lib/supabase/mode";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_SLUG } from "@/lib/schools";

export async function SetupBanner() {
  if (!isSupabaseMode()) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", DEFAULT_SCHOOL_SLUG)
    .maybeSingle();
  if (!error && data) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Supabase is connected, but database tables are missing or incomplete. Run{" "}
      <code className="rounded bg-amber-100 px-1">supabase/setup.sql</code>.
    </div>
  );
}

export function SetupRequiredMessage() {
  if (isDemoMode()) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>Database setup needed.</strong> Open your Supabase SQL Editor and run{" "}
      <code className="rounded bg-amber-100 px-1">supabase/setup.sql</code> to create tables and seed the default school data.
    </div>
  );
}
