"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteServiceHour } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function DeleteServiceHourButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm("Remove this service-hour entry? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteServiceHour(id);
      if (result.success) {
        toast({ title: "Service hours removed", description: "The entry was deleted." });
        router.refresh();
      } else {
        toast({ title: "Could not remove entry", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Remove service-hour entry"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Remove
    </Button>
  );
}
