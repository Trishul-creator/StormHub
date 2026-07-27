"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { archiveClubWorkspace } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function ArchiveClubWorkspace({
  clubId,
  clubName,
}: {
  clubId: string;
  clubName: string;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const matches = confirmation === clubName;

  function archive() {
    if (!matches || !window.confirm(`Archive ${clubName}? Members will no longer see it as active.`)) return;
    startTransition(async () => {
      const result = await archiveClubWorkspace({ clubId, confirmationName: confirmation });
      if (!result.success) {
        toast({ title: "Club was not archived", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Club archived", description: "The club is now inactive and unlisted." });
      router.push("/manage/clubs");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-red-300 bg-red-50/70 p-5 dark:border-red-900 dark:bg-red-950/25">
      <h2 className="font-semibold text-red-900 dark:text-red-100">Archive club</h2>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">
        This is the safe equivalent of deleting a club. Its history is retained for school records,
        but the club becomes inactive and unlisted.
      </p>
      <div className="mt-4">
        <Label htmlFor="archive-confirmation">
          Enter <span className="font-semibold">{clubName}</span> to confirm
        </Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="archive-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="bg-card"
          />
          <Button variant="destructive" onClick={archive} disabled={!matches || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Archive club
          </Button>
        </div>
      </div>
    </section>
  );
}
