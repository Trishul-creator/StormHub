import Link from "next/link";
import { isDemoMode, isSupabaseMode } from "@/lib/supabase/mode";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export async function SetupBanner({ role }: { role?: UserRole }) {
  if (role !== "super_admin") return null;
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
      The production database check could not read the required schema.{" "}
      <Link className="font-semibold underline underline-offset-2" href="/admin/system-health">
        Open System health
      </Link>{" "}
      for the exact recovery step.
    </div>
  );
}

export function SetupRequiredMessage() {
  if (isDemoMode()) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
      <strong>Database setup needed.</strong> Open your Supabase SQL Editor and apply{" "}
      every migration in <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase/migrations</code>,
      or run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">supabase db push</code> from the linked project.
    </div>
  );
}
