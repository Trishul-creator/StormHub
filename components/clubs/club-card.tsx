import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Club } from "@/types/database";
import { JoinClubButton } from "@/components/clubs/join-club-button";

interface ClubCardProps {
  club: Club;
  isMember?: boolean;
  isLoggedIn?: boolean;
  canJoin?: boolean;
  canManage?: boolean;
  schoolSlug?: string;
}

export function ClubCard({ club, isMember, isLoggedIn, canJoin, canManage, schoolSlug }: ClubCardProps) {
  const clubHref = schoolSlug ? `/s/${schoolSlug}/clubs/${club.slug}` : `/clubs/${club.slug}`;

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow border-storm-light/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">
            <Link href={clubHref} className="hover:text-storm-electric transition-colors">
              {club.name}
            </Link>
          </CardTitle>
          {club.is_featured && (
            <span className="shrink-0 rounded-full bg-storm-electric/10 px-2 py-0.5 text-xs font-medium text-storm-electric">
              Featured
            </span>
          )}
        </div>
        {club.category && <CategoryBadge category={club.category} />}
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{club.short_description}</p>
        {club.tags && club.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {club.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded bg-storm-light/50 px-2 py-0.5 text-xs text-storm-navy/70">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {club.member_count !== undefined && (
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{club.member_count} members</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={clubHref} data-tour="club-card-link">View</Link>
        </Button>
        <JoinClubButton
          clubSlug={club.slug}
          isMember={isMember}
          isLoggedIn={isLoggedIn}
          canJoin={canJoin}
          canManage={canManage}
          joinLabel={club.status === "interest_open" ? "Join / Get Updates" : "Join Club"}
          redirectHref={clubHref}
          size="sm"
          className="flex-1"
        />
      </CardFooter>
    </Card>
  );
}
