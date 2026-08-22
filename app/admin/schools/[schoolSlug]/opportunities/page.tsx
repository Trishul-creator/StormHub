import { notFound, redirect } from "next/navigation";
import { DeadlineReminderButton } from "@/components/manage/deadline-reminder-button";
import { OpportunityManagement } from "@/components/manage/opportunity-management";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { getManagedOpportunitiesForSchool } from "@/lib/opportunity-admin";
import { canAccessSchoolAdmin } from "@/lib/permissions";
import { getSchoolBySlug } from "@/lib/schools";
import { recordPlatformSupportAccess } from "@/lib/support-access";

interface SchoolOpportunityManagementPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolOpportunityManagementPage({
  params,
}: SchoolOpportunityManagementPageProps) {
  const { profile } = await requireAdmin();
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();
  if (!canAccessSchoolAdmin(profile, school.id, school.district_id)) {
    redirect("/admin?error=school_scope_required");
  }
  const readOnlySupport = profile.role === "super_admin";
  if (
    readOnlySupport
    && !await recordPlatformSupportAccess({
      actor: profile,
      schoolId: school.id,
      action: "view",
      resourceType: "school_opportunity_inventory",
      resourceId: school.id,
    })
  ) {
    redirect(`/admin/schools/${school.slug}#support-access`);
  }

  const opportunities = await getManagedOpportunitiesForSchool(profile, school);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={`${school.short_name || school.name} opportunities`}
        description={
          readOnlySupport
            ? "Recorded support view of the school inventory. Existing listings are read-only, but platform administrators may add a new public opportunity."
            : "This inventory is locked to the selected school and includes published, closed, archived, and draft listings."
        }
      >
        {!readOnlySupport && <DeadlineReminderButton schoolId={school.id} />}
      </PageHeader>
      <OpportunityManagement
        school={school}
        opportunities={opportunities}
        readOnly={readOnlySupport}
        allowCreate
      />
    </div>
  );
}
