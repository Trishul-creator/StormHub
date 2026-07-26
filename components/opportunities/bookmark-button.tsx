"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { bookmarkEntity } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface BookmarkButtonProps {
  opportunityId: string;
  isLoggedIn?: boolean;
  isBookmarked?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  activeLabel?: string;
  inactiveLabel?: string;
  disableWhenBookmarked?: boolean;
}

export function BookmarkButton({
  opportunityId,
  isLoggedIn,
  isBookmarked,
  size = "default",
  className,
  activeLabel = "Saved",
  inactiveLabel = "Save",
  disableWhenBookmarked = true,
}: BookmarkButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!isLoggedIn) {
    return (
      <Button size={size} variant="outline" asChild className={className}>
        <a
          href="/auth/sign-in?redirect=/opportunities"
          aria-label={size === "icon" ? "Sign in to save opportunity" : undefined}
          title={size === "icon" ? "Sign in to save opportunity" : undefined}
        >
          <Bookmark className="h-4 w-4" />
          {size !== "icon" && "Sign in to save"}
        </a>
      </Button>
    );
  }

  function handleBookmark() {
    if (isBookmarked && disableWhenBookmarked) return;
    startTransition(async () => {
      const result = await bookmarkEntity("opportunity", opportunityId);
      if (result.success) {
        toast({ title: isBookmarked ? "Removed from saved" : "Saved!", description: isBookmarked ? "Opportunity removed from your saved list." : "Opportunity added to your saved list." });
        router.refresh();
      } else {
        toast({ title: "Could not update saved item", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button
      size={size}
      variant={isBookmarked ? "secondary" : "outline"}
      onClick={handleBookmark}
      disabled={pending || Boolean(isBookmarked && disableWhenBookmarked)}
      className={cn(className)}
      aria-label={size === "icon" ? (isBookmarked ? "Remove from saved" : "Save opportunity") : undefined}
      title={size === "icon" ? (isBookmarked ? "Remove from saved" : "Save opportunity") : undefined}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isBookmarked ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {size !== "icon" && (isBookmarked ? activeLabel : inactiveLabel)}
    </Button>
  );
}
