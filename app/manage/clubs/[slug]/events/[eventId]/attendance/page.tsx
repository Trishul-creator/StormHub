import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EventAttendanceRoster } from "@/components/manage/event-attendance-roster";
import { requireClubManager } from "@/lib/auth";
import { getClubEventAttendance, getClubManagedContent, getManagedClubBySlug } from "@/lib/data";
import { canManageClubRoster } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import type { Event } from "@/types/database";

interface AttendancePageProps {
  params: Promise<{ slug: string; eventId: string }>;
}

export default async function ClubEventAttendancePage({ params }: AttendancePageProps) {
  const { slug, eventId } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);
  if (!canManageClubRoster(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}/events?error=attendance_permission_required`);
  }
  const events = (await getClubManagedContent(club.id, "event")) as Event[];
  const event = events.find((item) => item.id === eventId);
  if (!event) notFound();
  const entries = await getClubEventAttendance(eventId);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-5">
        <Link href={`/manage/clubs/${slug}/events`}>
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
      </Button>
      <PageHeader
        title={`Attendance — ${event.title}`}
        description={`${formatDateTime(event.starts_at)} · Mark each student as present, absent, or excused.`}
      />
      <EventAttendanceRoster clubSlug={slug} eventId={eventId} entries={entries} />
    </div>
  );
}
