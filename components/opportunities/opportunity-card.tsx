import Link from "next/link";
import { Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Opportunity } from "@/types/database";
import { formatDate, isDeadlineSoon, isOverdue, opportunityActionLabel } from "@/lib/utils";
import { BookmarkButton } from "@/components/opportunities/bookmark-button";
import { OpportunityParticipationButton } from "@/components/opportunities/opportunity-participation-button";

interface OpportunityCardProps {
  opportunity: Opportunity;
  isLoggedIn?: boolean;
  isBookmarked?: boolean;
  isSignedUp?: boolean;
  canParticipate?: boolean;
}

export function OpportunityCard({
  opportunity,
  isLoggedIn,
  isBookmarked,
  isSignedUp,
  canParticipate = true,
}: OpportunityCardProps) {
  const closingSoon = isDeadlineSoon(opportunity.deadline);
  const isClosed = isOverdue(opportunity.deadline);
  const actionLabel = opportunityActionLabel(opportunity.action_label);

  return (
    <Card className={`hover:shadow-md transition-shadow ${
      isSignedUp
        ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/35"
        : closingSoon
          ? "border-amber-300 dark:border-amber-800"
          : ""
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            <Link href={`/opportunities/${opportunity.slug}`} className="hover:text-storm-electric">
              {opportunity.title}
            </Link>
          </CardTitle>
          {closingSoon && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Closing soon
            </span>
          )}
          {isSignedUp && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3 w-3" />
              You&apos;re signed up
            </span>
          )}
        </div>
        {opportunity.category && <CategoryBadge category={opportunity.category} />}
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2">{opportunity.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {opportunity.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Deadline: {formatDate(opportunity.deadline)}
            </span>
          )}
          {opportunity.event_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Happens: {formatDate(opportunity.event_date)}
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/opportunities/${opportunity.slug}`} data-tour="opportunity-card-link">
            View details
          </Link>
        </Button>
        {canParticipate && (
          <>
            <BookmarkButton
              opportunityId={opportunity.id}
              isLoggedIn={isLoggedIn}
              isBookmarked={isBookmarked}
              size="icon"
              activeLabel="Saved"
              inactiveLabel="Save"
              disableWhenBookmarked={false}
              className="shrink-0"
            />
            <OpportunityParticipationButton
              opportunityId={opportunity.id}
              opportunitySlug={opportunity.slug}
              actionLabel={actionLabel}
              externalUrl={opportunity.external_url}
              isLoggedIn={isLoggedIn}
              isSignedUp={isSignedUp}
              isClosed={isClosed}
              compact
              className="shrink-0"
            />
          </>
        )}
      </CardFooter>
    </Card>
  );
}
