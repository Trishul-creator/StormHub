import Link from "next/link";
import { Calendar, ExternalLink } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Opportunity } from "@/types/database";
import { formatDate, isDeadlineSoon } from "@/lib/utils";
import { BookmarkButton } from "@/components/opportunities/bookmark-button";

interface OpportunityCardProps {
  opportunity: Opportunity;
  isLoggedIn?: boolean;
  isBookmarked?: boolean;
  canParticipate?: boolean;
}

export function OpportunityCard({ opportunity, isLoggedIn, isBookmarked, canParticipate = true }: OpportunityCardProps) {
  const closingSoon = isDeadlineSoon(opportunity.deadline);

  return (
    <Card className={`hover:shadow-md transition-shadow ${closingSoon ? "border-amber-300" : ""}`}>
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
          <Link href={`/opportunities/${opportunity.slug}`}>
            {opportunity.action_label || "Learn More"}
          </Link>
        </Button>
        {canParticipate && (
          <BookmarkButton
            opportunityId={opportunity.id}
            isLoggedIn={isLoggedIn}
            isBookmarked={isBookmarked}
            size="sm"
          />
        )}
      </CardFooter>
    </Card>
  );
}
