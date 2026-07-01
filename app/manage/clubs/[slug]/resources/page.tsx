import { notFound } from "next/navigation";
import { ContentForm } from "@/components/forms/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, Link as LinkIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { canApproveClubContent } from "@/lib/permissions";
import type { ClubResource } from "@/types/database";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageResourcesPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const resources = (await getClubManagedContent(club.id, "resource")) as ClubResource[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Create Resource" description={`For ${club.name} members`}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}/member`}><Eye className="h-4 w-4" /> View club dashboard</Link>
        </Button>
      </PageHeader>
      <ContentForm type="resource" clubSlug={slug} />
      <section className="mt-8 rounded-xl border bg-white p-5">
        <h2 className="font-semibold text-storm-navy">Previous resources</h2>
        <div className="mt-4 space-y-3">
          {resources.map((resource) => (
            <div key={resource.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-storm-navy">{resource.title}</p>
                    <StatusBadge status={resource.status} />
                  </div>
                  {resource.description && <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>}
                  {resource.resource_type === "link" && resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-storm-electric hover:underline"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      {resource.content || "Open resource"}
                    </a>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Posted {formatDateTime(resource.created_at)}</p>
                </div>
                {canDelete && <ArchiveContentButton id={resource.id} type="resource" />}
              </div>
            </div>
          ))}
          {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources yet.</p>}
        </div>
      </section>
    </div>
  );
}
