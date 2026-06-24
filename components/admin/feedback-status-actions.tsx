"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFeedbackStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { FeedbackStatus } from "@/types/database";

export function FeedbackStatusActions({
  id,
  status,
}: {
  id: string;
  status: FeedbackStatus;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(nextStatus: FeedbackStatus) {
    startTransition(async () => {
      const result = await updateFeedbackStatus(id, nextStatus);
      if (result.success) {
        toast({ title: "Feedback updated", description: `Marked as ${nextStatus}.` });
        router.refresh();
      } else {
        toast({ title: "Could not update feedback", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "reviewed" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("reviewed")}>
          Mark reviewed
        </Button>
      )}
      {status !== "resolved" && (
        <Button size="sm" disabled={pending} onClick={() => setStatus("resolved")}>
          Resolve
        </Button>
      )}
      {status !== "open" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("open")}>
          Reopen
        </Button>
      )}
    </div>
  );
}
