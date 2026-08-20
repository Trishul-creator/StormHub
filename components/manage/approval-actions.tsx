"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { approveContent, rejectContent, returnContentForRevision } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { ApprovalContentType } from "@/types/database";

export function ApprovalActions({
  id,
  type,
  disabled = false,
}: {
  id: string;
  type: ApprovalContentType;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | "revision" | null>(null);
  const router = useRouter();

  function run(nextAction: "approve" | "reject" | "revision") {
    startTransition(async () => {
      setAction(nextAction);
      const result = nextAction === "approve"
        ? await approveContent(id, type)
        : nextAction === "revision"
          ? await returnContentForRevision(id, type)
          : await rejectContent(id, type);
      if (result.success) {
        toast({
          title: nextAction === "approve" ? "Approved" : nextAction === "revision" ? "Returned for revision" : "Rejected",
          description: nextAction === "revision"
            ? `The ${type.replace("_", " ")} is private again and can be revised.`
            : `The ${type.replace("_", " ")} was ${nextAction === "approve" ? "approved" : "rejected"}.`,
        });
        router.refresh();
      } else {
        toast({
          title: `${nextAction === "approve" ? "Approval" : nextAction === "revision" ? "Revision return" : "Rejection"} failed`,
          description: result.error,
          variant: "destructive",
        });
      }
      setAction(null);
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => run("revision")}
        disabled={disabled || pending}
      >
        {pending && action === "revision" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        Revise
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => run("reject")}
        disabled={disabled || pending}
      >
        {pending && action === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        Reject
      </Button>
      <Button
        size="sm"
        onClick={() => run("approve")}
        disabled={disabled || pending}
      >
        {pending && action === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Approve
      </Button>
    </div>
  );
}
