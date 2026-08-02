import { PageHeader } from "@/components/layout/page-header";
import { requireApprover } from "@/lib/auth";
import { getPendingApprovals, isDemoMode } from "@/lib/data";
import { ApprovalQueue } from "@/components/manage/approval-queue";

export default async function ApprovalsPage() {
  await requireApprover();
  const pendingItems = await getPendingApprovals();
  const demo = isDemoMode();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Approval Queue" description="Review pending content from club leaders." />
      <ApprovalQueue items={pendingItems} actionsEnabled demo={demo} />
    </div>
  );
}
