"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { leaveClub } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { LogOut, Loader2 } from "lucide-react";

export function LeaveClubButton({ clubSlug }: { clubSlug: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleLeave() {
    if (!confirm("Are you sure you want to leave this club? You will lose access to member-only content.")) return;
    startTransition(async () => {
      const result = await leaveClub(clubSlug);
      if (result.success) {
        toast({ title: "Left club", description: "You no longer have access to member-only content." });
        router.push(`/clubs/${clubSlug}`);
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLeave} disabled={pending} className="shrink-0 border-white/30 bg-transparent text-white hover:bg-white/10">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Leave
    </Button>
  );
}
