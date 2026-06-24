import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinClubButton } from "@/components/clubs/join-club-button";

interface MemberBlockedProps {
  clubSlug: string;
  clubName: string;
  isLoggedIn: boolean;
}

export function MemberBlocked({ clubSlug, clubName, isLoggedIn }: MemberBlockedProps) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-storm-light">
        <Lock className="h-7 w-7 text-storm-electric" />
      </div>
      <h1 className="text-2xl font-bold text-storm-navy">Members only</h1>
      <p className="mt-2 text-muted-foreground">
        {clubName} member resources, announcements, and internal events are only available after you join the club.
      </p>
      <div className="mt-6 flex flex-col gap-3 items-center">
        <JoinClubButton clubSlug={clubSlug} isLoggedIn={isLoggedIn} size="lg" />
        <Button variant="ghost" asChild>
          <Link href={`/clubs/${clubSlug}`}>Back to public club page</Link>
        </Button>
      </div>
    </div>
  );
}
