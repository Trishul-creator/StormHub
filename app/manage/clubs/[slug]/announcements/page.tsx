import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { canApproveClubContent, canManageClubCoursework } from "@/lib/permissions";
import type { ClubAnnouncement } from "@/types/database";
import { ClubPostComposer } from "@/components/manage/club-post-composer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageAnnouncementsPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const announcements = (await getClubManagedContent(club.id, "announcement")) as ClubAnnouncement[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  const courseworkEnabled = canManageClubCoursework(auth.profile, club, auth.membership);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Create a club post" description={`Publish assignments, announcements, events, and materials for ${club.name}.`} />
      <ClubPostComposer
        clubSlug={slug}
        defaultType="announcement"
        courseworkEnabled={courseworkEnabled}
      />
      <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-storm-navy">Previous announcements</h2>
        <div className="mt-4 space-y-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-storm-navy">{announcement.title}</p>
                    <StatusBadge status={announcement.status} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{announcement.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Posted {formatDateTime(announcement.published_at ?? announcement.created_at)}
                  </p>
                </div>
                {canDelete && <ArchiveContentButton id={announcement.id} type="announcement" />}
              </div>
            </div>
          ))}
          {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        </div>
      </section>
    </div>
  );
}
