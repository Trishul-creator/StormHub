"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { submitAnnouncementForStaffApproval } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function SubmitAnnouncementForReviewButton({ announcementId }: { announcementId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      onClick={() => {
        startTransition(async () => {
          const result = await submitAnnouncementForStaffApproval(announcementId);
          if (!result.success) {
            toast({ title: "Could not submit for approval", description: result.error, variant: "destructive" });
            return;
          }
          toast({
            title: "Submitted for staff approval",
            description: "The announcement remains private until an Advisor or school administrator approves it.",
          });
          router.refresh();
        });
      }}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Submit for staff approval
    </Button>
  );
}
