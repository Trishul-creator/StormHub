import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FilePenLine, Rocket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { CategoryBadge } from "@/components/ui/badge";
import { requireManager } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";

export default async function DraftClubsPage() {
  const { profile } = await requireManager();
  if (profile.role === "super_admin") redirect("/admin/schools");

  const clubs = (await getManageableClubs(profile)).filter((club) => club.status === "draft");

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Draft Clubs"
        description="Prepare clubs before publishing them. Draft clubs are hidden from students until they are listed and opened."
      >
        <Button variant="outline" asChild>
          <Link href="/manage/clubs"><ArrowLeft className="h-4 w-4" /> Published clubs</Link>
        </Button>
        <Button asChild>
          <Link href="/manage/clubs/new">Propose club</Link>
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {clubs.map((club) => (
          <div key={club.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <div className="flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-storm-electric" />
                <p className="font-medium text-storm-navy">{club.name}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {club.category && <CategoryBadge category={club.category} />}
                <span className="text-xs text-muted-foreground">
                  Draft · hidden from students
                </span>
              </div>
              {club.short_description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{club.short_description}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/manage/clubs/${club.slug}`}>
                  Open workspace
                </Link>
              </Button>
              {profile.role === "admin" ? (
                <Button size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/edit?publish=1`}>
                    <Rocket className="mr-1 h-4 w-4" />
                    Review &amp; publish
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/edit`}>
                    Awaiting admin review
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
        {clubs.length === 0 && (
          <EmptyState
            title="No draft clubs"
            description="Draft clubs will appear here while admins confirm details before publishing."
            actionLabel="Propose club"
            actionHref="/manage/clubs/new"
          />
        )}
      </div>
    </div>
  );
}
