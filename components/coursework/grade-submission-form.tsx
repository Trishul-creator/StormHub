"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gradeClubAssignmentSubmission } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { ClubAssignmentSubmission } from "@/types/database";

export function GradeSubmissionForm({
  clubSlug,
  assignmentId,
  submission,
  pointsPossible,
}: {
  clubSlug: string;
  assignmentId: string;
  submission: ClubAssignmentSubmission;
  pointsPossible: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await gradeClubAssignmentSubmission({
      clubSlug,
      assignmentId,
      submissionId: submission.id,
      gradePoints: Number(form.get("grade_points") ?? 0),
      feedback: String(form.get("feedback") ?? ""),
    });
    setLoading(false);
    if (!result.success) {
      toast({ title: "Could not return grade", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Grade returned", description: "The student can now see the score and feedback." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t bg-storm-light/15 p-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <Label htmlFor={`grade-${submission.id}`}>Points</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id={`grade-${submission.id}`}
              name="grade_points"
              type="number"
              min="0"
              max={pointsPossible}
              step="0.01"
              defaultValue={submission.grade_points ?? ""}
              required
            />
            <span className="shrink-0 text-sm text-muted-foreground">/ {pointsPossible}</span>
          </div>
        </div>
        <div>
          <Label htmlFor={`feedback-${submission.id}`}>Private feedback</Label>
          <Textarea
            id={`feedback-${submission.id}`}
            name="feedback"
            rows={3}
            maxLength={10000}
            defaultValue={submission.feedback ?? ""}
            placeholder="Explain what went well and what to improve."
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          <CheckCircle2 className="h-4 w-4" />
          {loading ? "Returning..." : submission.status === "returned" ? "Update grade" : "Return grade"}
        </Button>
      </div>
    </form>
  );
}
