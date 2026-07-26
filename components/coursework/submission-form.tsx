"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitClubAssignment } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { ClubAssignmentSubmission } from "@/types/database";

export function SubmissionForm({
  clubSlug,
  assignmentId,
  submission,
  disabled = false,
}: {
  clubSlug: string;
  assignmentId: string;
  submission?: ClubAssignmentSubmission | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await submitClubAssignment({
      clubSlug,
      assignmentId,
      submissionText: String(form.get("submission_text") ?? ""),
      attachmentUrl: String(form.get("attachment_url") ?? ""),
    });
    setLoading(false);
    if (!result.success) {
      toast({ title: "Could not turn in assignment", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: submission ? "Assignment resubmitted" : "Assignment turned in",
      description: "Your club sponsor can now review your work.",
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="submission-text">Your response</Label>
        <Textarea
          id="submission-text"
          name="submission_text"
          rows={7}
          maxLength={20000}
          defaultValue={submission?.submission_text ?? ""}
          disabled={disabled}
          placeholder="Write your response or add context for the work you are submitting."
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="submission-link" className="flex items-center gap-1.5">
          <ExternalLink className="h-4 w-4" /> Submission link
        </Label>
        <Input
          id="submission-link"
          name="attachment_url"
          type="url"
          defaultValue={submission?.attachment_url ?? ""}
          disabled={disabled}
          placeholder="https://docs.google.com/..."
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Add a shareable Google Doc, Slides, Drive, or other web link. Make sure your sponsor can open it.
        </p>
      </div>
      <Button type="submit" disabled={disabled || loading} className="w-full">
        <Send className="h-4 w-4" />
        {loading ? "Turning in..." : submission ? "Resubmit assignment" : "Turn in assignment"}
      </Button>
      {disabled && (
        <p className="text-center text-xs text-muted-foreground">
          This assignment is closed and no longer accepts submissions.
        </p>
      )}
    </form>
  );
}
