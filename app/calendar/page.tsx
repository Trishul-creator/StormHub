import { EventsPageClient } from "@/components/events/events-page-client";
import { PageHeader } from "@/components/layout/page-header";
import { getCalendarEvents, getUserMemberships } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";

export default async function CalendarPage() {
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const [events, rsvpIds, memberships] = await Promise.all([
    getCalendarEvents(userId),
    getUserRsvpIds(userId),
    getUserMemberships(userId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Calendar"
        description={
          isLoggedIn
            ? "Your school calendar, including events from every club you belong to."
            : "School-wide meetings, competitions, auditions, deadlines, and other scheduled activities."
        }
      />
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
