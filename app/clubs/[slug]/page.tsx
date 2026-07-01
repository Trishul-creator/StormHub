import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, MapPin, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { JoinClubButton } from "@/components/clubs/join-club-button";
import { EventCard } from "@/components/events/event-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  getManagedClubBySlug,
  getClubAnnouncements,
  getClubEvents,
  getClubMemberCount,
  getUserClubMembership,
} from "@/lib/data";
import { getAuthContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { canManageClub } from "@/lib/permissions";
import { getUserRsvpIds } from "@/lib/actions";
import { getSchoolById } from "@/lib/schools";

interface ClubPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();

  const { isLoggedIn, profile, userId } = await getAuthContext();
  const membership = await getUserClubMembership(userId, club.id);
  const canManage = canManageClub(profile, club, membership);
  const isPubliclyVisible =
    club.is_listed &&
    club.visibility === "public" &&
    ["interest_open", "active"].includes(club.status);
  if (!isPubliclyVisible && !canManage) notFound();

  const school = await getSchoolById(club.school_id);
  const schoolClubsHref = school ? `/s/${school.slug}/clubs` : "/clubs";
  const clubHref = school ? `/s/${school.slug}/clubs/${club.slug}` : `/clubs/${club.slug}`;
  const [announcements, events, memberCount] = await Promise.all([
    getClubAnnouncements(club.id, "public"),
    getClubEvents(club.id),
    getClubMemberCount(club.id),
  ]);
  const isMember = !!membership;
  const rsvpIds = profile?.role === "student" ? await getUserRsvpIds(userId) : new Set<string>();

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={schoolClubsHref}><ArrowLeft className="h-4 w-4 mr-1" /> All clubs</Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              {club.category && <CategoryBadge category={club.category} />}
              {club.is_featured && (
                <span className="rounded-full bg-storm-electric/10 px-3 py-0.5 text-xs font-medium text-storm-electric">Featured</span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-storm-navy">{club.name}</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              {club.long_description || club.short_description}
            </p>
            {club.tags && (
              <div className="mt-4 flex flex-wrap gap-2">
                {club.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-storm-light px-3 py-1 text-xs text-storm-navy">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {announcements.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-storm-navy mb-4">Announcements</h2>
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="rounded-xl border p-4">
                    <h3 className="font-medium">{a.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Posted {formatDateTime(a.published_at ?? a.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-storm-navy mb-4">Upcoming events</h2>
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
          <div className="rounded-xl border bg-white p-6 sticky top-20">
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
              <p className="mt-3 text-xs text-center text-muted-foreground">
                You have access to the member page with resources and internal announcements.
              </p>
            )}

            <hr className="my-4" />

            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{memberCount} members</span>
              </div>
              {club.meeting_time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{club.meeting_time}</span>
                </div>
              )}
              {club.meeting_location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{club.meeting_location}</span>
                </div>
              )}
            </dl>

            {club.sponsor_name && (
              <>
                <hr className="my-4" />
                <div className="text-sm">
                  <p className="font-medium text-storm-navy">Sponsor</p>
                  <p className="text-muted-foreground">{club.sponsor_name}</p>
                  {club.sponsor_email && (
                    <p className="text-storm-electric text-xs mt-1">{club.sponsor_email}</p>
                  )}
                </div>
              </>
            )}

            {club.join_instructions && (
              <>
                <hr className="my-4" />
                <div className="text-sm">
                  <p className="font-medium text-storm-navy">How to join</p>
                  <p className="text-muted-foreground">{club.join_instructions}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
