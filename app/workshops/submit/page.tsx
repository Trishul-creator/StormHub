import { PageHeader } from "@/components/layout/page-header";
import { WorkshopSubmitForm } from "@/components/workshops/workshop-submit-form";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SubmitWorkshopPage() {
  const { profile } = await requireAuth("/workshops/submit");
  if (profile.role !== "student") redirect("/workshops");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Host a Workshop"
        description="Submit a student-led workshop or peer tutoring session for review."
      />
      <WorkshopSubmitForm />
    </div>
  );
}
