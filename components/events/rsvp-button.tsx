"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelRsvp, rsvpToEvent } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck, Loader2, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface RSVPButtonProps {
  eventId: string;
  isLoggedIn?: boolean;
  hasRsvp?: boolean;
  size?: "default" | "sm" | "lg";
  className?: string;
  canParticipate?: boolean;
}

export function RSVPButton({ eventId, isLoggedIn, hasRsvp, size = "default", className, canParticipate = true }: RSVPButtonProps) {
  const [pending, startTransition] = useTransition();
  const [rsvped, setRsvped] = useState(Boolean(hasRsvp));
  const router = useRouter();

  if (!canParticipate) return null;

  if (!isLoggedIn) {
    return (
      <Button size={size} variant="outline" asChild className={className}>
        <Link href={`/auth/sign-in?redirect=/events/${eventId}`}>Sign in to RSVP</Link>
      </Button>
    );
  }

  function handleRsvp() {
    startTransition(async () => {
      if (rsvped) return;
      const result = await rsvpToEvent(eventId);
      if (result.success) {
        setRsvped(true);
        toast({
          title: "RSVP confirmed",
          description: "You're marked as going to this event.",
        });
        router.refresh();
      } else {
        toast({ title: "RSVP failed", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleRemoveRsvp() {
    startTransition(async () => {
      const result = await cancelRsvp(eventId);
      if (result.success) {
        setRsvped(false);
        toast({
          title: "RSVP removed",
          description: "You are no longer marked as going to this event.",
        });
        router.refresh();
      } else {
        toast({ title: "Could not remove RSVP", description: result.error, variant: "destructive" });
      }
    });
  }

  if (rsvped) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Button size={size} variant="secondary" disabled className="flex-1">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
          Done
        </Button>
        <Button size={size} variant="outline" onClick={handleRemoveRsvp} disabled={pending} className="flex-1">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Remove RSVP
        </Button>
      </div>
    );
  }

  return (
    <Button size={size} variant="default" onClick={handleRsvp} disabled={pending} className={cn(className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
      RSVP
    </Button>
  );
}
