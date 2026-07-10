import { PageHeader } from "@/components/layout/page-header";
import { ApprovalStatusBadge } from "@/components/ui/badge";
import { requireApprover } from "@/lib/auth";
import { getPendingApprovals, isDemoMode } from "@/lib/data";
import { ApprovalActions } from "@/components/manage/approval-actions";
import { EmptyState } from "@/components/layout/empty-state";
import { formatDate } from "@/lib/utils";

export default async function ApprovalsPage() {
  await requireApprover();
  const pendingItems = await getPendingApprovals();
  const demo = isDemoMode();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Approval Queue" description="Review pending content from club officers." />
      <div className="space-y-3">
        {pendingItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ApprovalStatusBadge status="pending" />
                <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
              </div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {[item.context, item.submitted_at ? formatDate(item.submitted_at) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ApprovalActions id={item.id} type={item.type} disabled={demo} />
          </div>
        ))}
        {pendingItems.length === 0 && (
          <EmptyState
            title="No pending approvals"
            description="Submitted club content will appear here. Use the content and club tools to review what students and sponsors already published."
            actionLabel="View managed clubs"
            actionHref="/manage/clubs"
          />
        )}
      </div>
      {demo && (
        <p className="mt-4 text-sm text-muted-foreground">
          Demo content is shown for preview. Approval actions require live Supabase mode.
        </p>
      )}
    </div>
  );
}
