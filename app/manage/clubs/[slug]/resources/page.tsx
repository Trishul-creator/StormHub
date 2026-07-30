import { notFound } from "next/navigation";
import { ContentForm } from "@/components/forms/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { Link as LinkIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { ApprovalActions } from "@/components/manage/approval-actions";
import { canApproveClubContent, canManageClubCoursework, canPublishClubContent } from "@/lib/permissions";
import { ClubCreateNavigation } from "@/components/manage/club-create-navigation";
import type { ClubResource } from "@/types/database";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageResourcesPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const readOnlySupport = auth.readOnlySupport;
  const resources = (await getClubManagedContent(club.id, "resource")) as ClubResource[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  const canPublish = canPublishClubContent(auth.profile, club, auth.membership, "resource");
  const courseworkEnabled = canManageClubCoursework(auth.profile, club, auth.membership);
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title={readOnlySupport ? "Resources — read only" : "Create resource"}
        description={
          readOnlySupport
            ? `Inspect ${club.name} resources during this recorded support session.`
            : `Share links and materials with ${club.name} members.`
        }
      />
      {!readOnlySupport && (
        <>
          <ClubCreateNavigation clubSlug={slug} activeType="resource" courseworkEnabled={courseworkEnabled} />
          <ContentForm type="resource" clubSlug={slug} canPublish={canPublish} />
        </>
      )}
      <section className={`${readOnlySupport ? "mt-2" : "mt-8"} rounded-xl border bg-card p-5 shadow-sm`}>
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
                <div className="flex flex-wrap justify-end gap-2">
                  {canPublish && resource.status === "pending" && (
                    <ApprovalActions id={resource.id} type="resource" />
                  )}
                  {canDelete && <ArchiveContentButton id={resource.id} type="resource" />}
                </div>
              </div>
            </div>
          ))}
          {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources yet.</p>}
        </div>
      </section>
    </div>
  );
}
