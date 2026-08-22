import { ApprovalActions } from "@/components/manage/approval-actions";
import { EmptyState } from "@/components/layout/empty-state";
import { ApprovalStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { PendingApprovalItem } from "@/types/database";

export function ApprovalQueue({
  items,
  actionsEnabled,
  demo = false,
  emptyActionHref = "/manage/clubs",
}: {
  items: PendingApprovalItem[];
  actionsEnabled: boolean;
  demo?: boolean;
  emptyActionHref?: string;
}) {
  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.type}:${item.id}`}
            className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <ApprovalStatusBadge status="pending" />
                <span className="text-xs capitalize text-muted-foreground">{item.type}</span>
              </div>
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {[item.context, item.submitted_at ? formatDate(item.submitted_at) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {actionsEnabled ? (
              <ApprovalActions
                id={item.id}
                type={item.type}
                disabled={demo}
                reviewHref={item.action_href}
              />
            ) : (
              <p className="shrink-0 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Read-only platform view
              </p>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState
            title="No pending approvals"
            description="Submitted club content will appear here as soon as it needs review."
            actionLabel="View managed clubs"
            actionHref={emptyActionHref}
          />
        )}
      </div>
      {demo && (
        <p className="mt-4 text-sm text-muted-foreground">
          Demo content is shown for preview. Approval actions require live Supabase mode.
        </p>
      )}
    </>
  );
}
