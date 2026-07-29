import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ClubCreationOptions } from "@/components/manage/club-creation-options";
import { DraftClubCatalog } from "@/components/manage/draft-club-catalog";
import { requireAdmin } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";
import { getSchoolBySlug } from "@/lib/schools";

interface SchoolDraftsPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolDraftsPage({ params }: SchoolDraftsPageProps) {
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const clubs = (await getManageableClubs(profile, school.id)).filter((club) => club.status === "draft");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
        <strong>Platform Admin Mode</strong> — draft club catalog for {school.name}.
      </div>
      <PageHeader
        title={`Add a Club to ${school.short_name || school.name}`}
        description="Use a prepared starter or create a custom club. Every club stays private until it is reviewed and published."
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/schools/${school.slug}`}>Back to school</Link>
        </Button>
      </PageHeader>

      <ClubCreationOptions
        customClubHref={`/manage/clubs/new?school=${encodeURIComponent(school.slug)}`}
        customClubLabel="Create a custom club"
      />

      <section id="starter-club-catalog" className="scroll-mt-24" aria-labelledby="starter-club-catalog-title">
        <div className="mb-4">
          <h2 id="starter-club-catalog-title" className="text-xl font-semibold text-storm-navy">
            Starter club catalog
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a prepared club, confirm its details and Advisor, then publish it only for {school.name}.
          </p>
        </div>
        <DraftClubCatalog clubs={clubs} mode="platform-admin" />
      </section>
    </div>
  );
}
