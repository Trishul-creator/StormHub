"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { reviewAccountDeletionRequest } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function DeletionRequestReview({ requestId }: { requestId: string }) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function review(decision: "reject" | "complete") {
    if (decision === "complete" && !window.confirm("Permanently delete this account and its personal data? This cannot be undone.")) {
      return;
    }
    startTransition(async () => {
      const result = await reviewAccountDeletionRequest({ requestId, decision, reviewerNotes: notes });
      if (result.success) {
        toast({ title: decision === "complete" ? "Account deleted" : "Request rejected" });
        router.refresh();
      } else {
        toast({ title: "Could not review request", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-muted-foreground">Review notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          rows={2}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" onClick={() => review("complete")} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Complete deletion
        </Button>
        <Button size="sm" variant="outline" onClick={() => review("reject")} disabled={pending}>
          <XCircle className="h-4 w-4" /> Reject
        </Button>
      </div>
    </div>
  );
}
