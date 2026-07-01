import { notFound } from "next/navigation";
import { EventsPageClient } from "@/components/events/events-page-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCalendarEvents, getUserMemberships } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlug } from "@/lib/schools";

interface SchoolCalendarPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolCalendarPage({ params }: SchoolCalendarPageProps) {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const { userId, isLoggedIn, profile } = await getAuthContext();
  const [events, rsvpIds, memberships] = await Promise.all([
    getCalendarEvents(userId, school.id),
    getUserRsvpIds(userId),
    getUserMemberships(userId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={`${school.short_name || school.name} Calendar`}
        description="School-wide meetings, competitions, auditions, deadlines, and other scheduled activities."
      />
      <EventsPageClient
        events={events}
        deadlines={events.filter((event) => event.event_type === "deadline")}
        isLoggedIn={isLoggedIn}
        rsvpIds={[...rsvpIds]}
        userClubIds={memberships.filter((membership) => membership.club?.school_id === school.id).map((membership) => membership.club_id)}
        canParticipate={profile?.role === "student" && profile.school_id === school.id}
      />
    </div>
  );
}
