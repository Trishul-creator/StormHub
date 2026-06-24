import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventTypeBadge } from "@/components/ui/badge";
import { RSVPButton } from "@/components/events/rsvp-button";
import { getEventById } from "@/lib/data";
import { getUserRsvpIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { formatEventDate, formatDateTime } from "@/lib/utils";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const { userId, isLoggedIn, profile } = await getAuthContext();
  const canParticipate = profile?.role === "student" || !profile;
  const rsvpSet = canParticipate ? await getUserRsvpIds(userId) : new Set<string>();
  const hasRsvp = rsvpSet.has(event.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/calendar"><ArrowLeft className="h-4 w-4 mr-1" /> Back to calendar</Link>
      </Button>

      <div className="mb-4">
        <EventTypeBadge type={event.event_type} />
      </div>
      <h1 className="text-3xl font-bold text-storm-navy">{event.title}</h1>
      {event.club && (
        <Link href={`/clubs/${event.club.slug}`} className="mt-2 inline-block text-storm-electric hover:underline">
          {event.club.name}
        </Link>
      )}

      <div className="mt-6 rounded-xl border bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatEventDate(event.starts_at)}</span>
          {event.ends_at && <span className="text-muted-foreground">→ {formatDateTime(event.ends_at)}</span>}
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{event.location}</span>
          </div>
        )}
        {event.rsvp_count !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{event.rsvp_count} students going</span>
          </div>
        )}
      </div>

      {event.description && (
        <div className="mt-6">
          <h2 className="font-semibold text-storm-navy mb-2">About this event</h2>
          <p className="text-muted-foreground leading-relaxed">{event.description}</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <RSVPButton
          eventId={event.id}
          isLoggedIn={isLoggedIn}
          hasRsvp={hasRsvp}
          canParticipate={canParticipate}
          size="lg"
        />
        {event.external_url && (
          <Button variant="outline" size="lg" asChild>
            <a href={event.external_url} target="_blank" rel="noopener noreferrer">
              External link <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
