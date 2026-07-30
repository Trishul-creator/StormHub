import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getManagedClubBySlug, getClubAssignments, getClubManagedContent, getClubMemberCount } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { getSchoolById } from "@/lib/schools";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ClubAnnouncement, ClubResource, Event } from "@/types/database";
import { canManageClubCoursework } from "@/lib/permissions";

interface ManageClubPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageClubDashboard({ params }: ManageClubPageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership, readOnlySupport } = await requireClubManager(club);
  const canManageCoursework = readOnlySupport
    || canManageClubCoursework(profile, club, membership);
  const [school, memberCount, announcements, events, resources, assignments] = await Promise.all([
    getSchoolById(club.school_id),
    getClubMemberCount(club.id),
    getClubManagedContent(club.id, "announcement") as Promise<ClubAnnouncement[]>,
    getClubManagedContent(club.id, "event") as Promise<Event[]>,
    getClubManagedContent(club.id, "resource") as Promise<ClubResource[]>,
    canManageCoursework ? getClubAssignments(club.id) : Promise.resolve([]),
  ]);
  const publicHref = school ? `/s/${school.slug}/clubs/${club.slug}` : `/clubs/${club.slug}`;
  const isPubliclyVisible =
    club.is_listed &&
    club.visibility === "public" &&
    ["interest_open", "active"].includes(club.status);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={readOnlySupport ? "Read-only club overview" : "Club overview"}
        description={
          readOnlySupport
            ? `Inspect ${club.name} during this recorded support session. Changes are disabled.`
            : `Monitor ${club.name} content, classwork, events, resources, and membership.`
        }
      >
        {isPubliclyVisible ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={publicHref}>View public page</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Draft is not public
          </Button>
        )}
      </PageHeader>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">Club dashboard</p>
            <h2 className="mt-2 text-3xl font-bold">{club.name}</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">
              {club.short_description || club.long_description || "This draft has no description yet. Add details before publishing."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-white/5 px-5 py-4">
            <p className="text-3xl font-bold">{memberCount}</p>
            <p className="text-sm text-zinc-400">Members</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {canManageCoursework && <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Coursework</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/manage/clubs/${slug}/coursework`}>
                {readOnlySupport ? "Inspect" : "Manage"} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {assignments.slice(0, 3).map((assignment) => (
              <Link
                key={assignment.id}
                href={`/manage/clubs/${slug}/coursework/${assignment.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-storm-light/30"
              >
                <p className="text-sm font-medium">{assignment.title}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{assignment.status}</p>
              </Link>
            ))}
            {!assignments.length && (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            )}
          </div>
        </section>}

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Recent announcements</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={readOnlySupport
                ? `/manage/clubs/${slug}/announcements`
                : `/clubs/${slug}/member`}>
                View <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{announcement.title}</p>
                {announcement.published_at && (
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(announcement.published_at)}</p>
                )}
              </div>
            ))}
            {!announcements.length && (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Upcoming calendar</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={readOnlySupport ? `/manage/clubs/${slug}/events` : "/calendar"}>
                {readOnlySupport ? "Inspect" : "Calendar"} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {events.slice(0, 3).map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block rounded-lg border p-3 hover:bg-storm-light/30">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.starts_at)}</p>
              </Link>
            ))}
            {!events.length && (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-storm-navy">Member resources</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={readOnlySupport
                ? `/manage/clubs/${slug}/resources`
                : `/clubs/${slug}/member`}>
                View <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {resources.slice(0, 3).map((resource) => (
              <div key={resource.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{resource.title}</p>
                {resource.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{resource.description}</p>
                )}
              </div>
            ))}
            {!resources.length && (
              <p className="text-sm text-muted-foreground">No resources posted.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
