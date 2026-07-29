import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EventAttendanceRoster } from "@/components/manage/event-attendance-roster";
import { requireClubManager } from "@/lib/auth";
import { getClubEventAttendance, getClubManagedContent, getManagedClubBySlug } from "@/lib/data";
import { canManageClubRoster } from "@/lib/permissions";
import { getActivePlatformSupportSession, recordPlatformSupportAccess } from "@/lib/support-access";
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
  const supportSession = profile.role === "super_admin"
    ? await getActivePlatformSupportSession(profile, club.school_id)
    : null;
  if (profile.role !== "super_admin" && !canManageClubRoster(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}/events?error=attendance_permission_required`);
  }
  const events = (await getClubManagedContent(club.id, "event")) as Event[];
  const event = events.find((item) => item.id === eventId);
  if (!event) notFound();
  const canViewAttendance = profile.role !== "super_admin" || Boolean(supportSession);
  const entries = canViewAttendance ? await getClubEventAttendance(eventId) : [];
  if (supportSession) {
    await recordPlatformSupportAccess({
      actor: profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "club_event_attendance",
      resourceId: eventId,
    });
  }

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
      {profile.role === "super_admin" && !supportSession ? (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">A support session is required to view attendance</p>
              <p className="mt-1">
                Start a temporary school support session before viewing student attendance.
                The session and each view are logged for the school.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/admin/schools">Open school support</Link>
          </Button>
        </div>
      ) : (
        <>
          {supportSession && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>Read-only support session:</strong> viewing attendance is recorded.
                Attendance changes remain disabled for platform administrators.
              </p>
            </div>
          )}
          <EventAttendanceRoster
            clubSlug={slug}
            eventId={eventId}
            entries={entries}
            readOnly={profile.role === "super_admin"}
          />
        </>
      )}
    </div>
  );
}
