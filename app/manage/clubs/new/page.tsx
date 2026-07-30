import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ClubProposalForm } from "@/components/manage/club-proposal-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getSchoolTeachers } from "@/lib/data";
import {
  canAccessSchoolAdmin,
  canCreateClub,
  isAdminRole,
} from "@/lib/permissions";
import { getSchoolBySlug, getSchoolForProfile } from "@/lib/schools";

interface NewClubPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function NewClubPage({ searchParams }: NewClubPageProps) {
  const { profile } = await requireAuth("/manage/clubs/new");
  if (profile.role === "super_admin") {
    redirect("/admin/schools?error=platform_support_read_only");
  }
  if (profile.role !== "teacher" && !isAdminRole(profile.role)) redirect("/manage/clubs");

  const { school: requestedSchoolSlug } = await searchParams;
  const usesAdministrativeSchoolScope =
    profile.role === "district_admin";
  const school = usesAdministrativeSchoolScope
    ? requestedSchoolSlug
      ? await getSchoolBySlug(requestedSchoolSlug)
      : null
    : await getSchoolForProfile(profile);

  if (usesAdministrativeSchoolScope && !requestedSchoolSlug) {
    redirect("/admin");
  }
  if (requestedSchoolSlug && !school) notFound();
  if (!school) {
    redirect(usesAdministrativeSchoolScope ? "/admin" : "/manage/clubs");
  }
  if (
    usesAdministrativeSchoolScope
    && !canAccessSchoolAdmin(profile, school.id, school.district_id)
  ) {
    notFound();
  }

  const requiresApproval = !canCreateClub(profile, school.id, school.district_id);
  if (profile.role !== "teacher" && requiresApproval) redirect("/manage/clubs");

  const teachers = profile.role === "teacher"
    ? [profile]
    : await getSchoolTeachers(school.id);
  const returnHref = usesAdministrativeSchoolScope
    ? `/admin/schools/${school.slug}/drafts`
    : "/manage/clubs/drafts";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title={requiresApproval ? "Propose a Custom Club" : "Create a Custom Club"}
        description={
          requiresApproval
            ? `Submit a club idea for ${school.name} administrator review. It stays private until an administrator publishes it.`
            : `Create a club that is not in the starter catalog for ${school.name}. It stays private until you publish it.`
        }
      >
        <Button variant="outline" asChild>
          <Link href={returnHref}>
            <ArrowLeft className="h-4 w-4" />
            Back to add clubs
          </Link>
        </Button>
      </PageHeader>
      <ClubProposalForm
        requiresApproval={requiresApproval}
        teachers={teachers}
        defaultSponsorUserId={profile.role === "teacher" ? profile.id : undefined}
        targetSchoolId={school.id}
        returnHref={returnHref}
      />
    </div>
  );
}
