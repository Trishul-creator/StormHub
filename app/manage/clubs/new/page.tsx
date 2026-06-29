import { PageHeader } from "@/components/layout/page-header";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { requireAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function NewClubPage() {
  const { profile } = await requireAuth("/manage/clubs/new");
  if (profile.role !== "teacher" && !isAdminRole(profile.role)) redirect("/manage/clubs");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Propose a Club"
        description="Teachers can submit a club for admin review. It starts as an unlisted draft until an admin approves and lists it."
      />
      <ClubProposalForm />
    </div>
  );
}
