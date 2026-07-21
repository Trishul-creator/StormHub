import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

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

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("admin_audit_log")
        .select("*, actor:profiles!actor_user_id(full_name,email)")
        .order("occurred_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Administrative audit log" description="Immutable history for account, roster, approval, school, and content changes." />
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
