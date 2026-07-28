import { notFound } from "next/navigation";
import { EventsPageClient } from "@/components/events/events-page-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCalendarEvents, getOpportunities, getUserMemberships } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlugForViewer } from "@/lib/schools";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface SchoolCalendarPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SchoolCalendarPage({ params }: SchoolCalendarPageProps) {
  const { schoolSlug } = await params;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const school = await getSchoolBySlugForViewer(schoolSlug, profile);
  if (!school) notFound();

  const [events, opportunities, rsvpIds, memberships] = await Promise.all([
    getCalendarEvents(userId, school.id),
    getOpportunities({ schoolId: school.id }),
    getUserRsvpIds(userId),
    getUserMemberships(userId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title={`${school.short_name || school.name} Calendar`}
        description="School-wide meetings, competitions, auditions, deadlines, and other scheduled activities."
      />
      <EventsPageClient
        events={events}
        opportunities={opportunities.filter((opportunity) =>
          opportunity.status === "approved" &&
          opportunity.visibility === "public" &&
          Boolean(opportunity.event_date || opportunity.deadline)
        )}
        isLoggedIn={isLoggedIn}
        rsvpIds={[...rsvpIds]}
        userClubIds={memberships.filter((membership) => membership.club?.school_id === school.id).map((membership) => membership.club_id)}
        canParticipate={!profile || (profile.role === "student" && profile.school_id === school.id)}
      />
    </div>
  );
}
