import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
        title={`${school.short_name || school.name} Draft Clubs`}
        description="Prepared club templates are hidden from students until a school admin edits and publishes them."
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/schools/${school.slug}`}>Back to school</Link>
        </Button>
      </PageHeader>

      <DraftClubCatalog clubs={clubs} mode="platform-admin" />
    </div>
  );
}
