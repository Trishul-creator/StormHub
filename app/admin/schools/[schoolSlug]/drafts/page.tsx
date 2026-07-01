import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FilePenLine, Rocket, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { CategoryBadge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";
import { getSchoolBySlug } from "@/lib/schools";

interface SchoolDraftsPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolDraftsPage({ params }: SchoolDraftsPageProps) {
  const { profile } = await requireAuth("/admin/schools");
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const clubs = (await getManageableClubs(profile, school.id)).filter((club) => club.status === "draft");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
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

      <div className="space-y-3">
        {clubs.map((club) => (
          <div key={club.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-storm-electric" />
                <p className="font-medium text-storm-navy">{club.name}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {club.category && <CategoryBadge category={club.category} />}
                <span className="text-xs text-muted-foreground">
                  Draft · hidden from students · {club.meeting_time || "meeting TBD"}
                </span>
              </div>
              {club.short_description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{club.short_description}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/manage/clubs/${club.slug}`}>
                  <Settings className="mr-1 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/manage/clubs/${club.slug}/edit?publish=1`}>
                  <Rocket className="mr-1 h-4 w-4" />
                  Publish
                </Link>
              </Button>
            </div>
          </div>
        ))}
        {clubs.length === 0 && (
          <EmptyState
            title="No draft clubs"
            description="Run the Elkhorn South draft catalog reset script, or create draft clubs manually."
          />
        )}
      </div>
    </div>
  );
}
