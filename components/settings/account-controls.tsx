"use client";

import { useTransition } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { requestAccountDeletion } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function AccountControls() {
  const [pending, startTransition] = useTransition();

  function requestDeletion() {
    const reason = window.prompt("Optional: tell the administrator why you want this account deleted.") ?? undefined;
    if (reason === undefined) return;
    startTransition(async () => {
      const result = await requestAccountDeletion(reason);
      toast({
        title: result.success ? "Deletion requested" : "Could not submit request",
        description: result.success ? "An administrator will review the request and contact you if needed." : result.error,
        variant: result.success ? "default" : "destructive",
      });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href="/api/account/export"><Download className="h-4 w-4" /> Export my data</a>
      </Button>
      <Button variant="outline" onClick={requestDeletion} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Request account deletion
      </Button>
    </div>
  );
}
