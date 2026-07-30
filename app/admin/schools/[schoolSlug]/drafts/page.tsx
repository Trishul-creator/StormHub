import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ClubCreationOptions } from "@/components/manage/club-creation-options";
import { DraftClubCatalog } from "@/components/manage/draft-club-catalog";
import { requireAdmin } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";
import { canAccessSchoolAdmin } from "@/lib/permissions";
import { getSchoolBySlug } from "@/lib/schools";
import { recordPlatformSupportAccess } from "@/lib/support-access";

interface SchoolDraftsPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolDraftsPage({ params }: SchoolDraftsPageProps) {
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
      resourceType: "draft_club_catalog",
      resourceId: school.id,
    })
  ) {
    redirect(`/admin/schools/${school.slug}#support-access`);
  }

  const clubs = (await getManageableClubs(profile, school.id)).filter((club) => club.status === "draft");
  const modeLabel = profile.role === "super_admin"
    ? "Platform Admin Mode"
    : profile.role === "district_admin"
      ? "District Admin Mode"
      : "School Admin Mode";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
        <strong>{readOnlySupport ? "Recorded read-only support" : modeLabel}</strong>
        {" — "}
        {readOnlySupport
          ? `you may inspect ${school.name} drafts, but cannot create, edit, publish, archive, or delete them.`
          : `draft club catalog for ${school.name}.`}
      </div>
      <PageHeader
        title={`Add a Club to ${school.short_name || school.name}`}
        description="Use a prepared starter or create a custom club. Every club stays private until it is reviewed and published."
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/schools/${school.slug}`}>Back to school</Link>
        </Button>
      </PageHeader>

      {!readOnlySupport && (
        <ClubCreationOptions
          customClubHref={`/manage/clubs/new?school=${encodeURIComponent(school.slug)}`}
          customClubLabel="Create a custom club"
        />
      )}

      <section id="starter-club-catalog" className="scroll-mt-24" aria-labelledby="starter-club-catalog-title">
        <div className="mb-4">
          <h2 id="starter-club-catalog-title" className="text-xl font-semibold text-storm-navy">
            Starter club catalog
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a prepared club, confirm its details and Advisor, then publish it only for {school.name}.
          </p>
        </div>
        <DraftClubCatalog
          clubs={clubs}
          mode={profile.role === "super_admin" ? "platform-admin" : "admin"}
          readOnly={readOnlySupport}
        />
      </section>
    </div>
  );
}
