import { notFound } from "next/navigation";
import { ContentForm } from "@/components/forms/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { ApprovalActions } from "@/components/manage/approval-actions";
import { canApproveClubContent, canManageClubCoursework, canManageClubRoster, canPublishClubContent } from "@/lib/permissions";
import { ClubCreateNavigation } from "@/components/manage/club-create-navigation";
import type { Event } from "@/types/database";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { getActivePlatformSupportSession } from "@/lib/support-access";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageEventsPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const events = (await getClubManagedContent(club.id, "event")) as Event[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  const canPublish = canPublishClubContent(auth.profile, club, auth.membership, "event");
  const supportSession = auth.profile.role === "super_admin"
    ? await getActivePlatformSupportSession(auth.profile, club.school_id)
    : null;
  const canTakeAttendance = auth.profile.role === "super_admin"
    ? Boolean(supportSession)
    : canManageClubRoster(auth.profile, club, auth.membership);
  const courseworkEnabled = canManageClubCoursework(auth.profile, club, auth.membership);
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Create event" description={`Schedule a meeting, practice, deadline, or activity for ${club.name}.`} />
      <ClubCreateNavigation clubSlug={slug} activeType="event" courseworkEnabled={courseworkEnabled} />
      <ContentForm type="event" clubSlug={slug} canPublish={canPublish} />
      <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-storm-navy">Previous events</h2>
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-storm-navy">{event.title}</p>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.ends_at ? ` → ${formatDateTime(event.ends_at)}` : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {canTakeAttendance && event.status === "approved" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/manage/clubs/${slug}/events/${event.id}/attendance`}>
                        <ClipboardCheck className="h-4 w-4" /> Attendance
                      </Link>
                    </Button>
                  )}
                  {canPublish && event.status === "pending" && (
                    <ApprovalActions id={event.id} type="event" />
                  )}
                  {canDelete && <ArchiveContentButton id={event.id} type="event" />}
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        </div>
      </section>
    </div>
  );
}
