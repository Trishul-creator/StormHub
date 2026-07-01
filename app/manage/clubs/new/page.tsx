import { PageHeader } from "@/components/layout/page-header";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { requireAuth } from "@/lib/auth";
import { getSchoolTeachers } from "@/lib/data";
import { isAdminRole } from "@/lib/permissions";
import { getCurrentSchool } from "@/lib/schools";
import { redirect } from "next/navigation";

export default async function NewClubPage() {
  const { profile } = await requireAuth("/manage/clubs/new");
  if (profile.role !== "teacher" && !isAdminRole(profile.role)) redirect("/manage/clubs");
  const requiresApproval = profile.role === "teacher";
  const school = await getCurrentSchool(profile);
  const teachers = profile.role === "teacher"
    ? [profile]
    : await getSchoolTeachers(profile.school_id ?? school?.id);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title={requiresApproval ? "Propose a Club" : "Create Draft Club"}
        description={
          requiresApproval
            ? "Submit a club idea for school admin review. It starts hidden until an admin publishes it."
            : "Create a hidden draft club for your school. Students will not see it until you publish it."
        }
      />
      <ClubProposalForm requiresApproval={requiresApproval} teachers={teachers} defaultSponsorUserId={profile.role === "teacher" ? profile.id : undefined} />
    </div>
  );
}
