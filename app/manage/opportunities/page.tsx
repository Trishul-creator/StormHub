import { redirect } from "next/navigation";
import { DeadlineReminderButton } from "@/components/manage/deadline-reminder-button";
import { OpportunityManagement } from "@/components/manage/opportunity-management";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { getManagedOpportunitiesForSchool } from "@/lib/opportunity-admin";
import { getSchoolById } from "@/lib/schools";

export default async function ManageOpportunitiesPage() {
  const { profile } = await requireAdmin();
  if (profile.role !== "admin" || !profile.school_id) {
    redirect("/admin/schools");
  }

  const school = await getSchoolById(profile.school_id);
  if (!school) redirect("/admin?error=school_scope_required");
  const opportunities = await getManagedOpportunitiesForSchool(profile, school);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={`${school.short_name || school.name} opportunities`}
        description="Create, revise, close, archive, and review every school-wide opportunity from one inventory."
      >
        <DeadlineReminderButton schoolId={school.id} />
      </PageHeader>
      <OpportunityManagement school={school} opportunities={opportunities} />
    </div>
  );
}
