import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EventTypeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/database";
import { formatEventDate } from "@/lib/utils";
import { RSVPButton } from "@/components/events/rsvp-button";

interface EventCardProps {
  event: Event;
  isLoggedIn?: boolean;
  hasRsvp?: boolean;
  canParticipate?: boolean;
}

export function EventCard({ event, isLoggedIn, hasRsvp, canParticipate = true }: EventCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <Link href={`/events/${event.id}`} className="hover:text-storm-electric">
              {event.title}
            </Link>
          </CardTitle>
          <EventTypeBadge type={event.event_type} />
        </div>
        {event.club && (
          <Link href={`/clubs/${event.club.slug}`} className="text-xs text-storm-electric hover:underline">
            {event.club.name}
          </Link>
        )}
      </CardHeader>
      <CardContent className="pb-2">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        )}
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatEventDate(event.starts_at)}
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </div>
          )}
          {event.rsvp_count !== undefined && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {event.rsvp_count} going
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/events/${event.id}`}>Details</Link>
        </Button>
        <RSVPButton
          eventId={event.id}
          isLoggedIn={isLoggedIn}
          hasRsvp={hasRsvp}
          canParticipate={canParticipate}
          size="sm"
          className="flex-1"
        />
      </CardFooter>
    </Card>
  );
}
