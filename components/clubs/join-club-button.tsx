"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { joinClub } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Check, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface JoinClubButtonProps {
  clubSlug: string;
  isMember?: boolean;
  isLoggedIn?: boolean;
  size?: "default" | "sm" | "lg";
  className?: string;
  canJoin?: boolean;
  canManage?: boolean;
  joinLabel?: string;
  redirectHref?: string;
}

export function JoinClubButton({
  clubSlug,
  isMember,
  isLoggedIn,
  size = "default",
  className,
  canJoin = true,
  canManage = false,
  joinLabel = "Join Club",
  redirectHref,
}: JoinClubButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (canManage) {
    return (
      <Button size={size} asChild className={className}>
        <Link href={`/manage/clubs/${clubSlug}`}>
          <Settings className="h-4 w-4" /> Manage Club
        </Link>
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button size={size} variant="secondary" asChild className={className}>
        <Link href={`/clubs/${clubSlug}/member`}>
          <Check className="h-4 w-4" /> Member page
        </Link>
      </Button>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button size={size} asChild className={className}>
        <Link href={`/auth/sign-in?redirect=${encodeURIComponent(redirectHref || `/clubs/${clubSlug}`)}`}>
          <UserPlus className="h-4 w-4" /> Sign in to join
        </Link>
      </Button>
    );
  }

  if (!canJoin) return null;

  function handleJoin() {
    startTransition(async () => {
      const result = await joinClub(clubSlug);
      if (result.success) {
        toast({ title: "You're in!", description: "You now have access to this club's member page, resources, announcements, and upcoming events." });
        router.refresh();
      } else {
        toast({ title: "Could not join", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button size={size} onClick={handleJoin} disabled={pending} className={cn(className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      {joinLabel}
    </Button>
  );
}
