"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateOpportunityDeadlineReminders } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";

export function DeadlineReminderButton({ schoolId }: { schoolId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await generateOpportunityDeadlineReminders(schoolId);
        toast({
          title: result.success ? "Deadline reminders generated" : "Could not generate reminders",
          description: result.success ? `${result.count ?? 0} notification(s) processed.` : result.error,
          variant: result.success ? "default" : "destructive",
        });
      })}
    >
      {pending ? "Generating..." : "Generate deadline reminders"}
    </Button>
  );
}
