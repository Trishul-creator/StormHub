import { ApprovalQueue } from "@/components/manage/approval-queue";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { getPendingApprovals, isDemoMode } from "@/lib/data";
import { canApproveContent } from "@/lib/permissions";

export default async function AdminContentPage() {
  const { profile } = await requireAdmin();
  const [pendingItems, demo] = await Promise.all([
    getPendingApprovals(),
    Promise.resolve(isDemoMode()),
  ]);
  const actionsEnabled = canApproveContent(profile);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Moderation and approvals"
        description={actionsEnabled
          ? "Review pending content within your administrative scope."
          : "Inspect pending content across the platform. School and district administrators complete approval actions."}
      />
      <ApprovalQueue
        items={pendingItems}
        actionsEnabled={actionsEnabled}
        demo={demo}
        emptyActionHref={profile.role === "admin" ? "/manage/clubs" : "/admin/districts"}
      />
    </div>
  );
}
