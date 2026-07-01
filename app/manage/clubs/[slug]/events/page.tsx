import { notFound } from "next/navigation";
import { ContentForm } from "@/components/forms/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubManagedContent } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ArchiveContentButton } from "@/components/manage/archive-content-button";
import { canApproveClubContent } from "@/lib/permissions";
import type { Event } from "@/types/database";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageEventsPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const events = (await getClubManagedContent(club.id, "event")) as Event[];
  const canDelete = canApproveClubContent(auth.profile, club, auth.membership);
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Create Event" description={`For ${club.name}`}>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}/member`}><Eye className="h-4 w-4" /> View club dashboard</Link>
        </Button>
      </PageHeader>
      <ContentForm type="event" clubSlug={slug} />
      <section className="mt-8 rounded-xl border bg-white p-5">
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
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                {canDelete && <ArchiveContentButton id={event.id} type="event" />}
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        </div>
      </section>
    </div>
  );
}
