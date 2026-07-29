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
import { getSchoolById } from "@/lib/schools";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";
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
  const supportSchool = profile.role === "super_admin"
    ? await getSchoolById(club.school_id)
    : null;
  if (profile.role !== "super_admin" && !canManageClubRoster(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}/events?error=attendance_permission_required`);
  }
  const events = (await getClubManagedContent(club.id, "event")) as Event[];
  const event = events.find((item) => item.id === eventId);
  if (!event) notFound();
  const supportAccessRecorded = supportSession
    ? await recordPlatformSupportAccess({
      actor: profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "club_event_attendance",
      resourceId: eventId,
    })
    : false;
  const canViewAttendance = profile.role !== "super_admin" || supportAccessRecorded;
  const entries = canViewAttendance ? await getClubEventAttendance(eventId) : [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {supportSession && supportSchool && (
        <PlatformSupportExpiryGuard
          expiresAt={supportSession.expires_at}
          returnTo={`/admin/schools/${supportSchool.slug}/support`}
        />
      )}
      <Button variant="ghost" size="sm" asChild className="mb-5">
        <Link href={`/manage/clubs/${slug}/events`}>
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
      </Button>
      <PageHeader
        title={`Attendance — ${event.title}`}
        description={`${formatDateTime(event.starts_at)} · Mark each student as present, absent, or excused.`}
      />
      {profile.role === "super_admin" && !canViewAttendance ? (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {supportSession
                  ? "Attendance stayed locked because access could not be recorded"
                  : "A support session is required to view attendance"}
              </p>
              <p className="mt-1">
                {supportSession
                  ? "Private information is never shown when the required support audit entry cannot be created. Return to school support and try again."
                  : "Start a temporary school support session before viewing student attendance. The session and each view are logged for the school."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={supportSchool
              ? `/admin/schools/${supportSchool.slug}#support-access`
              : "/admin/schools"}>
              Open school support
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {supportSession && supportAccessRecorded && (
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
