"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelOpportunitySignup, registerForOpportunity } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/cn";

interface OpportunityParticipationButtonProps {
  opportunityId: string;
  opportunitySlug: string;
  actionLabel: string;
  externalUrl?: string | null;
  isLoggedIn?: boolean;
  isSignedUp?: boolean;
  isClosed?: boolean;
  compact?: boolean;
  className?: string;
}

export function OpportunityParticipationButton({
  opportunityId,
  opportunitySlug,
  actionLabel,
  externalUrl,
  isLoggedIn,
  isSignedUp,
  isClosed = false,
  compact = false,
  className,
}: OpportunityParticipationButtonProps) {
  const [registered, setRegistered] = useState(Boolean(isSignedUp));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isRsvp = actionLabel.trim().toLowerCase() === "rsvp";
  const completeLabel = isRsvp ? "RSVP confirmed" : "Signed up";

  if (isClosed && !registered) {
    return (
      <Button type="button" size={compact ? "sm" : "default"} variant="secondary" disabled className={className}>
        <CalendarCheck2 className="h-4 w-4" />
        Closed
      </Button>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button size="sm" asChild className={className}>
        <Link href={`/auth/sign-in?redirect=/opportunities/${opportunitySlug}`}>
          {isRsvp ? "Sign in to RSVP" : "Sign in to sign up"}
        </Link>
      </Button>
    );
  }

  function participate() {
    if (registered) return;
    if (externalUrl) window.open(externalUrl, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const result = await registerForOpportunity(opportunityId);
      if (result.success) {
        setRegistered(true);
        toast({
          title: completeLabel,
          description: externalUrl
            ? "The external form opened in a new tab, and StormHub highlighted this opportunity for you."
            : isRsvp
              ? "You are marked as attending."
              : "This opportunity is now highlighted in your directory.",
        });
        router.refresh();
      } else {
        toast({ title: "Could not update participation", description: result.error, variant: "destructive" });
      }
    });
  }

  function withdraw() {
    startTransition(async () => {
      const result = await cancelOpportunitySignup(opportunityId);
      if (result.success) {
        setRegistered(false);
        toast({
          title: isRsvp ? "RSVP canceled" : "Sign-up removed",
          description: "You can sign up again while the opportunity remains open.",
        });
        router.refresh();
      } else {
        toast({ title: "Could not withdraw", description: result.error, variant: "destructive" });
      }
    });
  }

  if (registered) {
    if (compact) {
      return (
        <span className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-100 px-3 text-sm font-medium text-emerald-800",
          className
        )}>
          <CheckCircle2 className="h-4 w-4" />
          {completeLabel}
        </span>
      );
    }
    return (
      <div className={cn("grid gap-2", className)}>
        <Button type="button" variant="secondary" disabled>
          <CheckCircle2 className="h-4 w-4" />
          {completeLabel}
        </Button>
        <Button type="button" variant="outline" onClick={withdraw} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          {isRsvp ? "Cancel RSVP" : "Withdraw"}
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" size={compact ? "sm" : "default"} onClick={participate} disabled={pending} className={className}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : externalUrl ? (
        <ExternalLink className="h-4 w-4" />
      ) : (
        <CalendarCheck2 className="h-4 w-4" />
      )}
      {actionLabel}
    </Button>
  );
}
