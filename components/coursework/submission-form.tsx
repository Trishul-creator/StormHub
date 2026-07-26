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
import type {
  AssignmentSubmissionMode,
  ClubAssignmentSubmission,
  ClubSubmissionAttachment,
} from "@/types/database";
import { SubmissionAttachments } from "@/components/coursework/submission-attachments";

export function SubmissionForm({
  clubSlug,
  assignmentId,
  submission,
  submissionMode = "submission",
  attachments = [],
  disabled = false,
}: {
  clubSlug: string;
  assignmentId: string;
  submission?: ClubAssignmentSubmission | null;
  submissionMode?: AssignmentSubmissionMode;
  attachments?: ClubSubmissionAttachment[];
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
      {submissionMode === "submission" ? (
        <>
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
              You can also submit a private upload or choose a file directly from Google Drive.
            </p>
          </div>
          <div className="border-t pt-4">
            <SubmissionAttachments
              clubSlug={clubSlug}
              assignmentId={assignmentId}
              attachments={attachments}
              disabled={disabled}
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-sm font-medium text-emerald-950">No file or written response is required.</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900/70">
            Use the button below when you finish the activity.
          </p>
        </div>
      )}
      <Button type="submit" disabled={disabled || loading} className="w-full">
        <Send className="h-4 w-4" />
        {loading
          ? submissionMode === "completion" ? "Marking complete..." : "Turning in..."
          : submissionMode === "completion"
            ? submission ? "Mark complete again" : "Mark as complete"
            : submission ? "Resubmit assignment" : "Turn in assignment"}
      </Button>
      {disabled && (
        <p className="text-center text-xs text-muted-foreground">
          This assignment is closed and no longer accepts submissions.
        </p>
      )}
    </form>
  );
}
