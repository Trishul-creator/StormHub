"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClubAssignmentStatus } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { AssignmentStatus } from "@/types/database";

export function AssignmentStatusActions({
  clubSlug,
  assignmentId,
  status,
}: {
  clubSlug: string;
  assignmentId: string;
  status: AssignmentStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function update(nextStatus: "published" | "closed" | "archived") {
    setLoading(true);
    const result = await updateClubAssignmentStatus({ clubSlug, assignmentId, status: nextStatus });
    setLoading(false);
    if (!result.success) {
      toast({ title: "Could not update assignment", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: nextStatus === "published" ? "Assignment published" : nextStatus === "closed" ? "Submissions closed" : "Assignment archived",
    });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button size="sm" disabled={loading} onClick={() => update("published")}>
          <Send className="h-4 w-4" /> Publish
        </Button>
      )}
      {status === "published" && (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => update("closed")}>
          <Lock className="h-4 w-4" /> Close submissions
        </Button>
      )}
      {status === "closed" && (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => update("published")}>
          <Send className="h-4 w-4" /> Reopen
        </Button>
      )}
      {status !== "archived" && (
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => update("archived")}>
          <Archive className="h-4 w-4" /> Archive
        </Button>
      )}
    </div>
  );
}
