import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { ApprovalActions } from "@/components/manage/approval-actions";
import { canApproveClubContent, canManageClubCoursework, canPublishClubContent } from "@/lib/permissions";
import type { ClubAnnouncement } from "@/types/database";
import { ClubCreateNavigation } from "@/components/manage/club-create-navigation";
import { ContentForm } from "@/components/forms/content-form";
import { getSchoolSettings } from "@/lib/schools";
import { SubmitAnnouncementForReviewButton } from "@/components/manage/submit-announcement-for-review-button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageAnnouncementsPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const readOnlySupport = auth.readOnlySupport;
  const announcements = (await getClubManagedContent(club.id, "announcement")) as ClubAnnouncement[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  const canPublish = canPublishClubContent(auth.profile, club, auth.membership, "announcement");
  const schoolSettings = await getSchoolSettings(club.school_id);
  const staffReviewRequired = Boolean(
    auth.profile.role === "student"
    && schoolSettings.student_content_requires_staff_approval
  );
  const courseworkEnabled = canManageClubCoursework(auth.profile, club, auth.membership);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title={readOnlySupport ? "Announcements — read only" : "Create for your club"}
        description={
          readOnlySupport
            ? `Inspect ${club.name} announcements during this recorded support session.`
            : `Publish announcements, assignments, events, and materials for ${club.name}.`
        }
      />
      {!readOnlySupport && (
        <>
          <ClubCreateNavigation
            clubSlug={slug}
            activeType="announcement"
            courseworkEnabled={courseworkEnabled}
          />
          <ContentForm
            type="announcement"
            clubSlug={slug}
            canPublish={canPublish && !staffReviewRequired}
            staffReviewRequired={staffReviewRequired}
          />
        </>
      )}
      <section className={`${readOnlySupport ? "mt-2" : "mt-8"} rounded-xl border bg-card p-5 shadow-sm`}>
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
                    {announcement.scheduled_for && announcement.status === "draft"
                      ? `Scheduled for ${formatDateTime(announcement.scheduled_for)}`
                      : `Posted ${formatDateTime(announcement.published_at ?? announcement.created_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {staffReviewRequired
                    && announcement.status === "draft"
                    && announcement.author_id === auth.profile.id
                    && (
                      <SubmitAnnouncementForReviewButton announcementId={announcement.id} />
                    )}
                  {canPublish && announcement.status === "pending" && (
                    <ApprovalActions id={announcement.id} type="announcement" />
                  )}
                  {canDelete && <ArchiveContentButton id={announcement.id} type="announcement" />}
                </div>
              </div>
            </div>
          ))}
          {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        </div>
      </section>
    </div>
  );
}
