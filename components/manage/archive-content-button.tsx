"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { archiveClubContent } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ArchiveContentButton({
  id,
  type,
}: {
  id: string;
  type: "announcement" | "event" | "resource";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function archive() {
    if (!window.confirm(`Delete this ${type}? It will be removed from students but kept archived in the database.`)) return;
    startTransition(async () => {
      const result = await archiveClubContent(id, type);
      if (result.success) {
        toast({ title: "Deleted", description: `The ${type} was removed from the club.` });
        router.refresh();
      } else {
        toast({ title: "Could not delete", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button size="sm" variant="destructive" onClick={archive} disabled={pending}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      Delete
    </Button>
  );
}
