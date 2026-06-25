"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { submitContent } from "@/lib/actions";
import { humanizeLabel } from "@/lib/utils";
import type { NotificationImportance } from "@/types/database";

interface ContentFormProps {
  type: "announcement" | "event" | "resource" | "opportunity";
  clubSlug?: string;
}

export function ContentForm({ type, clubSlug }: ContentFormProps) {
  const [loading, setLoading] = useState(false);
  const [importance, setImportance] = useState<NotificationImportance>("normal");
  const [sendEmail, setSendEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await submitContent({
      type,
      clubSlug,
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
      starts_at: String(form.get("starts_at") ?? "") || undefined,
      location: String(form.get("location") ?? "") || undefined,
      category: String(form.get("category") ?? "") || undefined,
      deadline: String(form.get("deadline") ?? "") || undefined,
      event_date: String(form.get("event_date") ?? "") || undefined,
      external_url: String(form.get("external_url") ?? "") || undefined,
      action_label: String(form.get("action_label") ?? "") || undefined,
      resource_url: String(form.get("resource_url") ?? "") || undefined,
      resource_label: String(form.get("resource_label") ?? "") || undefined,
      importance,
      send_email_to_members: form.get("send_email_to_members") === "on",
      deadline_reminder_enabled: form.get("deadline_reminder_enabled") === "on",
    });
    setLoading(false);
    if (!result.success) {
      toast({ title: "Submission failed", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: result.approved ? "Published" : "Submitted for approval",
      description: result.approved
        ? `Your ${type} is now available.`
        : `Your ${type} has been submitted and is pending review.`,
    });
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="body">{type === "resource" ? "Description or notes" : "Content"}</Label>
        <Textarea id="body" name="body" required rows={5} className="mt-1" />
      </div>
      {type === "resource" && (
        <div className="rounded-xl border bg-storm-light/20 p-4 space-y-4">
          <div>
            <Label htmlFor="resource_url">Resource link</Label>
            <Input
              id="resource_url"
              name="resource_url"
              type="url"
              placeholder="https://docs.google.com/..."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. If you add a link, members can click it from the resources list.
            </p>
          </div>
          <div>
            <Label htmlFor="resource_label">Clickable link text</Label>
            <Input
              id="resource_label"
              name="resource_label"
              placeholder="Open study guide"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This is the text shown for the hyperlink. If blank, StormHub uses “Open resource”.
            </p>
          </div>
        </div>
      )}
      {type === "event" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="starts_at">Start date/time</Label>
            <Input id="starts_at" name="starts_at" type="datetime-local" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" className="mt-1" />
          </div>
        </div>
      )}
      {type === "opportunity" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                placeholder="Science, College, Scholarship..."
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="action_label">Button label</Label>
              <Input
                id="action_label"
                name="action_label"
                placeholder="Sign Up, Apply, Register..."
                defaultValue="Sign Up"
                required
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="deadline">Sign-up deadline</Label>
              <Input id="deadline" name="deadline" type="datetime-local" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="event_date">Opportunity date</Label>
              <Input id="event_date" name="event_date" type="datetime-local" className="mt-1" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="external_url">Sign-up link</Label>
              <Input
                id="external_url"
                name="external_url"
                type="url"
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>
        </>
      )}
      {type !== "resource" && (
        <div className="rounded-xl border bg-storm-light/20 p-4 space-y-3">
          <div>
            <Label htmlFor="importance">Notification importance</Label>
            <select
              id="importance"
              name="importance"
              value={importance}
              onChange={(event) => {
                const next = event.target.value as NotificationImportance;
                setImportance(next);
                if (next === "normal") setSendEmail(false);
                if (next === "urgent") setSendEmail(true);
              }}
              className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="normal">Normal — in-app only</option>
              <option value="important">Important — email optional</option>
              <option value="urgent">Urgent — email by default</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="send_email_to_members"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
              disabled={importance === "normal"}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium">Queue email notification</span>
              <span className="block text-xs text-muted-foreground">
                Normal announcements create in-app notifications only. Use email only for important changes.
              </span>
            </span>
          </label>
          {type === "event" && importance === "urgent" && (
            <p className="text-xs text-red-700">
              Urgent is appropriate for cancellations or major time/location changes.
            </p>
          )}
          {type === "opportunity" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="deadline_reminder_enabled" className="mt-1 h-4 w-4" />
              <span>
                <span className="font-medium">Enable deadline reminders</span>
                <span className="block text-xs text-muted-foreground">
                  Admins can manually generate reminders for students who saved this opportunity.
                </span>
              </span>
            </label>
          )}
        </div>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Submitting..." : type === "opportunity" ? "Publish Opportunity" : `Create ${humanizeLabel(type)}`}
      </Button>
    </form>
  );
}
