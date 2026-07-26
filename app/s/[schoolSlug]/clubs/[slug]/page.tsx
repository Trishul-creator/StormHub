import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { JoinClubButton } from "@/components/clubs/join-club-button";
import { EventCard } from "@/components/events/event-card";
import {
  getClubAnnouncements,
  getClubBySlug,
  getClubEvents,
  getClubMemberCount,
  getUserClubMembership,
} from "@/lib/data";
import { getAuthContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { canManageClub } from "@/lib/permissions";
import { getUserRsvpIds } from "@/lib/actions";
import { getSchoolBySlug } from "@/lib/schools";

interface SchoolClubPageProps {
  params: Promise<{ schoolSlug: string; slug: string }>;
}

export default async function SchoolClubPage({ params }: SchoolClubPageProps) {
  const { schoolSlug, slug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const club = await getClubBySlug(slug, school.id);
  if (!club) notFound();

  const { isLoggedIn, profile, userId } = await getAuthContext();
  const [announcements, events, memberCount, membership] = await Promise.all([
    getClubAnnouncements(club.id, "public"),
    getClubEvents(club.id),
    getClubMemberCount(club.id),
    getUserClubMembership(userId, club.id),
  ]);
  const isMember = !!membership;
  const canManage = canManageClub(profile, club, membership);
  const rsvpIds = profile?.role === "student" ? await getUserRsvpIds(userId) : new Set<string>();
  const clubHref = `/s/${school.slug}/clubs/${club.slug}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/s/${school.slug}/clubs`}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {school.short_name || school.name} clubs
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              {club.category && <CategoryBadge category={club.category} />}
              {club.is_featured && (
                <span className="rounded-full bg-storm-electric/10 px-3 py-0.5 text-xs font-medium text-storm-electric">
                  Featured
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-storm-navy">{club.name}</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {club.long_description || club.short_description}
            </p>
            {club.tags && club.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {club.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-storm-light px-3 py-1 text-xs text-storm-navy">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {announcements.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-storm-navy">Announcements</h2>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="rounded-xl border p-4">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{announcement.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Posted {formatDateTime(announcement.published_at ?? announcement.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-storm-navy">Upcoming events</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isLoggedIn={isLoggedIn}
                    hasRsvp={rsvpIds.has(event.id)}
                    canParticipate={profile?.role === "student" || !profile}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <div className="sticky top-20 rounded-xl border bg-white p-6">
            <JoinClubButton
              clubSlug={slug}
              isMember={isMember}
              isLoggedIn={isLoggedIn}
              canJoin={profile?.role === "student"}
              canManage={canManage}
              joinLabel={club.status === "interest_open" ? "Join / Get Updates" : "Join Club"}
              redirectHref={clubHref}
              className="w-full"
            />
            {isMember && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                You have access to the member page with resources and internal announcements.
              </p>
            )}
            <div className="mt-5 space-y-3 text-sm">
              {club.sponsor_name && (
                <div>
                  <p className="font-medium text-storm-navy">Sponsor</p>
                  <p className="text-muted-foreground">{club.sponsor_name}</p>
                </div>
              )}
              <div>
                <p className="font-medium text-storm-navy">Members</p>
                <p className="text-muted-foreground">{memberCount} people joined</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
