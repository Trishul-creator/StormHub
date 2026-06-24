"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { approveContent, rejectContent } from "@/lib/actions";
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
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const router = useRouter();

  function run(nextAction: "approve" | "reject") {
    startTransition(async () => {
      setAction(nextAction);
      const result = nextAction === "approve"
        ? await approveContent(id, type)
        : await rejectContent(id, type);
      if (result.success) {
        toast({
          title: nextAction === "approve" ? "Approved" : "Rejected",
          description: `The ${type.replace("_", " ")} was ${nextAction === "approve" ? "approved" : "rejected"}.`,
        });
        router.refresh();
      } else {
        toast({
          title: `${nextAction === "approve" ? "Approval" : "Rejection"} failed`,
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
