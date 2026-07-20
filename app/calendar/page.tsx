import { EventsPageClient } from "@/components/events/events-page-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCalendarEvents, getUserMemberships } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { SchoolFilter } from "@/components/layout/school-filter";
import { getSchoolFilterContext } from "@/lib/schools";

interface CalendarPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const { schools, selectedSchool } = await getSchoolFilterContext(profile, params.school);
  const [events, rsvpIds, memberships] = await Promise.all([
    getCalendarEvents(userId, selectedSchool?.id),
    getUserRsvpIds(userId),
    getUserMemberships(userId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Calendar"
        description={
          isLoggedIn
            ? `${selectedSchool?.short_name || selectedSchool?.name || "Your school"} calendar, including events from every club you belong to.`
            : "School-wide meetings, competitions, auditions, deadlines, and other scheduled activities."
        }
      />
      <div className="mb-6 flex justify-end">
        <SchoolFilter schools={schools} activeSlug={selectedSchool?.slug} />
      </div>
      <EventsPageClient
        events={events}
        deadlines={events.filter((event) => event.event_type === "deadline")}
        isLoggedIn={isLoggedIn}
        rsvpIds={[...rsvpIds]}
        userClubIds={memberships.map((membership) => membership.club_id)}
        canParticipate={profile?.role === "student" || !profile}
      />
    </div>
  );
}
