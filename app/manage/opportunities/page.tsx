import { PageHeader } from "@/components/layout/page-header";
import { ContentForm } from "@/components/forms/content-form";
import { requireAdmin } from "@/lib/auth";
import { DeadlineReminderButton } from "@/components/manage/deadline-reminder-button";

export default async function ManageOpportunitiesPage() {
  await requireAdmin();
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader
        title="Create School-wide Opportunity"
        description="Post a science fair, college visit, scholarship, application, audition, or other action students can sign up for. Club meetings belong on the calendar instead."
      >
        <DeadlineReminderButton />
      </PageHeader>
      <ContentForm type="opportunity" />
    </div>
  );
}
