"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rsvpToEvent } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck, Loader2 } from "lucide-react";
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
      if (hasRsvp) return;
      const result = await rsvpToEvent(eventId);
      if (result.success) {
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

  return (
    <Button size={size} variant={hasRsvp ? "secondary" : "default"} onClick={handleRsvp} disabled={pending || hasRsvp} className={cn(className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
      {hasRsvp ? "Done" : "RSVP"}
    </Button>
  );
}
