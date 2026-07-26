"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClubAssignment } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/cn";

export function AssignmentForm({
  clubSlug,
  className,
}: {
  clubSlug: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [publishNow, setPublishNow] = useState(true);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    const form = new FormData(formElement);
    const result = await createClubAssignment({
      clubSlug,
      title: String(form.get("title") ?? ""),
      instructions: String(form.get("instructions") ?? ""),
      dueAt: String(form.get("due_at") ?? "") || null,
      pointsPossible: Number(form.get("points_possible") ?? 100),
      attachmentUrl: String(form.get("attachment_url") ?? "") || null,
      publishNow,
    });
    setLoading(false);

    if (!result.success) {
      toast({ title: "Could not create assignment", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: publishNow ? "Assignment published" : "Draft saved",
      description: publishNow
        ? "Club members can now view and submit this assignment."
        : "Only coursework managers can see this draft.",
    });
    formElement.reset();
    setPublishNow(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-5 rounded-xl border bg-white p-6", className)}>
      <div>
        <Label htmlFor="assignment-title">Assignment title</Label>
        <Input
          id="assignment-title"
          name="title"
          maxLength={200}
          required
          placeholder="Practice reflection, permission form, project checkpoint..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="assignment-instructions">Instructions</Label>
        <Textarea
          id="assignment-instructions"
          name="instructions"
          rows={7}
          maxLength={20000}
          placeholder="Explain what members should complete and what a strong submission includes."
          className="mt-1.5"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="assignment-due-at" className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Due date and time
          </Label>
          <Input id="assignment-due-at" name="due_at" type="datetime-local" className="mt-1.5" />
          <p className="mt-1 text-xs text-muted-foreground">Optional. Late work remains clearly marked.</p>
        </div>
        <div>
          <Label htmlFor="assignment-points">Points possible</Label>
          <Input
            id="assignment-points"
            name="points_possible"
            type="number"
            min="0"
            max="10000"
            step="0.01"
            defaultValue="100"
            required
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-storm-light/20 p-4">
        <Label htmlFor="assignment-attachment" className="flex items-center gap-1.5">
          <LinkIcon className="h-4 w-4" /> Instructions or resource link
        </Label>
        <Input
          id="assignment-attachment"
          name="attachment_url"
          type="url"
          placeholder="https://docs.google.com/..."
          className="mt-1.5 bg-white"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Add a Google Doc, form, reference page, or other web resource.
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
            className="mt-1 h-4 w-4 accent-storm-electric"
          />
          <span>
            <span className="block text-sm font-medium text-storm-navy">Publish now</span>
            <span className="block text-xs text-muted-foreground">
              Turn this off to save a private draft.
            </span>
          </span>
        </label>
        <Button type="submit" disabled={loading} className="sm:min-w-40">
          {loading ? "Saving..." : publishNow ? "Publish assignment" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
