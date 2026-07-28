import { EventsPageClient } from "@/components/events/events-page-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCalendarEvents, getOpportunities, getUserMemberships } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { SchoolFilter } from "@/components/layout/school-filter";
import { getSchoolFilterContext } from "@/lib/schools";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface CalendarPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const { schools, selectedSchool } = await getSchoolFilterContext(profile, params.school);
  const [events, opportunities, rsvpIds, memberships] = await Promise.all([
    getCalendarEvents(userId, selectedSchool?.id),
    getOpportunities({ schoolId: selectedSchool?.id }),
    getUserRsvpIds(userId),
    getUserMemberships(userId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
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
        opportunities={opportunities.filter((opportunity) =>
          opportunity.status === "approved" &&
          opportunity.visibility === "public" &&
          Boolean(opportunity.event_date || opportunity.deadline)
        )}
        isLoggedIn={isLoggedIn}
        rsvpIds={[...rsvpIds]}
        userClubIds={memberships.map((membership) => membership.club_id)}
        canParticipate={profile?.role === "student" || !profile}
      />
    </div>
  );
}
