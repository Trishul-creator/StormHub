import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";
import { DatabaseZap } from "lucide-react";
import { getPlatformSupportAvailability } from "@/lib/support-access";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  occurred_at: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  actor?: { full_name?: string | null; email?: string | null } | null;
};

type SupportAuditRow = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  occurred_at: string;
  actor?: { full_name?: string | null; email?: string | null } | null;
  session?: { reason?: string | null; expires_at?: string | null } | null;
};

export default async function AuditPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();
  const supportAvailability = await getPlatformSupportAvailability();
  const normalAuditPromise = supabase
    ? supabase
        .from("admin_audit_log")
        .select("*, actor:profiles!actor_user_id(full_name,email)")
        .order("occurred_at", { ascending: false })
        .limit(200)
    : Promise.resolve({ data: [] });
  let supportAuditQuery = admin && supportAvailability.available
    ? admin
        .from("platform_support_access_log")
        .select("*, actor:profiles!actor_user_id(full_name,email), session:platform_support_sessions!session_id(reason,expires_at)")
        .order("occurred_at", { ascending: false })
        .limit(200)
    : null;
  if (supportAuditQuery && profile.role !== "super_admin" && profile.school_id) {
    supportAuditQuery = supportAuditQuery.eq("school_id", profile.school_id);
  }
  const [{ data }, supportResult] = await Promise.all([
    normalAuditPromise,
    supportAuditQuery ?? Promise.resolve({ data: [] }),
  ]);
  const normalRows = (data ?? []) as unknown as AuditRow[];
  const supportRows = ((supportResult.data ?? []) as unknown as SupportAuditRow[]).map(
    (row): AuditRow => ({
      id: `support:${row.id}`,
      action: row.action,
      entity_type: `platform_support_${row.resource_type}`,
      entity_id: row.resource_id,
      occurred_at: row.occurred_at,
      old_data: {},
      new_data: {
        access: row.action,
        reason: row.session?.reason ?? "Recorded support access",
        expires_at: row.session?.expires_at ?? null,
      },
      actor: row.actor,
    })
  );
  const rows = [...normalRows, ...supportRows]
    .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at))
    .slice(0, 200);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Administrative audit log"
        description="History for account, roster, approval, school, content, and temporary platform-support access."
      />
      {!supportAvailability.available && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Support audit history is unavailable:</strong> the privacy and support
            database update has not been applied in this environment. Standard administrative
            history below is still current.
          </p>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No administrative changes yet" description="New privileged changes will appear here." />
      ) : (
        <div className="overflow-x-auto border-y">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">Actor</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Entity</th>
                <th className="px-3 py-3 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDateTime(row.occurred_at)}</td>
                  <td className="px-3 py-3">{row.actor?.full_name || row.actor?.email || "System"}</td>
                  <td className="px-3 py-3 capitalize">{row.action}</td>
                  <td className="px-3 py-3"><span className="font-medium">{row.entity_type.replaceAll("_", " ")}</span><br /><span className="font-mono text-xs text-muted-foreground">{row.entity_id || "-"}</span></td>
                  <td className="max-w-md px-3 py-3 font-mono text-xs text-muted-foreground">
                    {summarizeChange(row.old_data, row.new_data)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function summarizeChange(oldData: Record<string, unknown>, newData: Record<string, unknown>): string {
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
  const changes = keys
    .filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))
    .slice(0, 8)
    .map((key) => `${key}: ${formatValue(oldData[key])} -> ${formatValue(newData[key])}`);
  return changes.join("; ") || "Recorded change";
}

function formatValue(value: unknown): string {
  if (value === undefined) return "unset";
  if (value === null) return "null";
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return serialized.length > 80 ? `${serialized.slice(0, 77)}...` : serialized;
}
