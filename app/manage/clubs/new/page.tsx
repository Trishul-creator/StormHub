import { PageHeader } from "@/components/layout/page-header";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { requireAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function NewClubPage() {
  const { profile } = await requireAuth("/manage/clubs/new");
  if (profile.role !== "teacher" && !isAdminRole(profile.role)) redirect("/manage/clubs");
  const requiresApproval = profile.role === "teacher";

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
      <ClubProposalForm requiresApproval={requiresApproval} />
    </div>
  );
}
