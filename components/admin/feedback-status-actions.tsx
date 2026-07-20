"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToFeedback, updateFeedbackStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { FeedbackStatus } from "@/types/database";

export function FeedbackStatusActions({
  id,
  status,
  canReply,
}: {
  id: string;
  status: FeedbackStatus;
  canReply: boolean;
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

  function respond(formData: FormData) {
    const message = String(formData.get("response") ?? "");
    startTransition(async () => {
      const result = await respondToFeedback(id, message);
      if (result.success) {
        toast({ title: "Response queued", description: "The reply was added to email delivery and the message was resolved." });
        router.refresh();
      } else {
        toast({ title: "Could not send response", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="w-full space-y-3 md:w-72">
      {canReply && (
        <form action={respond} className="space-y-2">
          <Textarea
            name="response"
            rows={3}
            placeholder="Write a response that will be emailed to the sender..."
            disabled={pending}
          />
          <Button size="sm" type="submit" disabled={pending} className="w-full">
            Queue response & resolve
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {status !== "reviewed" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("reviewed")}>
            Mark reviewed
          </Button>
        )}
        {status !== "resolved" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("resolved")}>
            Resolve without email
          </Button>
        )}
        {status !== "open" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("open")}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
