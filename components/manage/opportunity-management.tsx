"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ExternalLink, Loader2, LockKeyhole, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ContentForm } from "@/components/forms/content-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  deleteOpportunity,
  setOpportunityStatus,
  updateOpportunity,
} from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import type { Opportunity, School } from "@/types/database";

interface OpportunityManagementProps {
  school: School;
  opportunities: Opportunity[];
  readOnly?: boolean;
}

function datetimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function OpportunityManagement({
  school,
  opportunities,
  readOnly = false,
}: OpportunityManagementProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const publishedCount = opportunities.filter((item) => item.status === "approved").length;
  const closedCount = opportunities.filter((item) => item.status === "closed").length;

  function refreshWithMessage(title: string, description: string) {
    toast({ title, description });
    startTransition(() => router.refresh());
  }

  async function changeStatus(
    opportunity: Opportunity,
    status: "approved" | "closed" | "archived"
  ) {
    setBusyId(opportunity.id);
    const result = await setOpportunityStatus({
      id: opportunity.id,
      schoolId: school.id,
      status,
    });
    setBusyId(null);
    if (!result.success) {
      toast({
        title: "Status was not changed",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    refreshWithMessage(
      status === "approved" ? "Opportunity published" : status === "closed" ? "Opportunity closed" : "Opportunity archived",
      status === "approved"
        ? "Students can now find this opportunity."
        : "The listing is no longer visible to students, and its history was retained."
    );
  }

  async function remove(opportunity: Opportunity) {
    if (
      !window.confirm(
        `Permanently delete “${opportunity.title}”? Only unpublished opportunities without student activity can be deleted.`
      )
    ) {
      return;
    }
    setBusyId(opportunity.id);
    const result = await deleteOpportunity({
      id: opportunity.id,
      schoolId: school.id,
    });
    setBusyId(null);
    if (!result.success) {
      toast({
        title: "Opportunity was not deleted",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    refreshWithMessage("Opportunity deleted", "The unpublished opportunity was permanently removed.");
  }

  async function save(
    event: React.FormEvent<HTMLFormElement>,
    opportunity: Opportunity
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(opportunity.id);
    const result = await updateOpportunity({
      id: opportunity.id,
      schoolId: school.id,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? ""),
      actionLabel: String(form.get("action_label") ?? ""),
      deadline: String(form.get("deadline") ?? ""),
      eventDate: String(form.get("event_date") ?? ""),
      location: String(form.get("location") ?? ""),
      externalUrl: String(form.get("external_url") ?? ""),
    });
    setBusyId(null);
    if (!result.success) {
      toast({
        title: "Opportunity was not updated",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    refreshWithMessage("Opportunity updated", "The saved details are now current.");
  }

  return (
    <div className="space-y-8" data-tour="opportunity-management">
      {readOnly && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>Recorded read-only support:</strong> listing details are available for
          inspection, but creating, editing, publishing, closing, archiving, deleting,
          and sending reminders are disabled.
        </div>
      )}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Opportunity inventory summary">
        <Summary label="All listings" value={opportunities.length} />
        <Summary label="Published" value={publishedCount} tone="success" />
        <Summary label="Closed" value={closedCount} tone="muted" />
      </section>

      {!readOnly && <details className="group overflow-hidden rounded-2xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="font-semibold text-storm-navy">Create an opportunity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish an application, audition, scholarship, tryout, or other school-wide listing.
            </p>
          </div>
          <span className="text-sm font-medium text-storm-electric group-open:hidden">Open form</span>
          <span className="hidden text-sm font-medium text-storm-electric group-open:inline">Close form</span>
        </summary>
        <div className="border-t p-3 sm:p-5">
          <ContentForm
            type="opportunity"
            schoolId={school.id}
            className="border-0 p-0 shadow-none"
          />
        </div>
      </details>}

      <section aria-labelledby="opportunity-inventory-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="opportunity-inventory-title" className="text-xl font-semibold text-storm-navy">
              Existing opportunities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Closed and archived listings retain signup history. Only unused, unpublished drafts can be deleted.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/s/${school.slug}/opportunities`}>
              Preview student view <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
            <p className="font-medium text-storm-navy">No opportunities yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the form above to publish the first school-wide opportunity.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opportunity) => {
              const busy = busyId === opportunity.id || isPending;
              const deletable = ["draft", "pending", "rejected"].includes(opportunity.status);
              return (
                <article key={opportunity.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-storm-navy">{opportunity.title}</h3>
                        <StatusBadge status={opportunity.status} />
                        {opportunity.category && <Badge variant="outline">{opportunity.category}</Badge>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {opportunity.summary || opportunity.description || "No description provided."}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {opportunity.deadline
                          ? `Deadline ${formatDateTime(opportunity.deadline)}`
                          : "No deadline"}
                        {opportunity.event_date
                          ? ` · Takes place ${formatDateTime(opportunity.event_date)}`
                          : ""}
                      </p>
                    </div>

                    {!readOnly && <div className="flex shrink-0 flex-wrap gap-2">
                      {opportunity.status === "approved" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => changeStatus(opportunity, "closed")}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                          Close
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => changeStatus(opportunity, "approved")}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {opportunity.status === "closed" || opportunity.status === "archived" ? "Reopen" : "Publish"}
                        </Button>
                      )}
                      {opportunity.status !== "archived" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => changeStatus(opportunity, "archived")}
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                      {deletable && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => remove(opportunity)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>}
                  </div>

                  {!readOnly && <details className="group border-t">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-storm-electric">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit details
                    </summary>
                    <form onSubmit={(event) => save(event, opportunity)} className="grid gap-4 border-t p-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label htmlFor={`title-${opportunity.id}`}>Title</Label>
                        <Input id={`title-${opportunity.id}`} name="title" defaultValue={opportunity.title} required className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor={`description-${opportunity.id}`}>Description</Label>
                        <Textarea
                          id={`description-${opportunity.id}`}
                          name="description"
                          defaultValue={opportunity.description ?? opportunity.summary ?? ""}
                          required
                          rows={5}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`category-${opportunity.id}`}>Category</Label>
                        <Input id={`category-${opportunity.id}`} name="category" defaultValue={opportunity.category ?? "Other"} required className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor={`action-${opportunity.id}`}>Button label</Label>
                        <Input id={`action-${opportunity.id}`} name="action_label" defaultValue={opportunity.action_label ?? "Sign Up"} required className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor={`deadline-${opportunity.id}`}>Deadline</Label>
                        <Input id={`deadline-${opportunity.id}`} name="deadline" type="datetime-local" defaultValue={datetimeLocalValue(opportunity.deadline)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor={`event-date-${opportunity.id}`}>Opportunity date</Label>
                        <Input id={`event-date-${opportunity.id}`} name="event_date" type="datetime-local" defaultValue={datetimeLocalValue(opportunity.event_date)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor={`location-${opportunity.id}`}>Location</Label>
                        <Input id={`location-${opportunity.id}`} name="location" defaultValue={opportunity.location ?? ""} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor={`url-${opportunity.id}`}>Sign-up link</Label>
                        <Input id={`url-${opportunity.id}`} name="external_url" type="url" defaultValue={opportunity.external_url ?? ""} className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Button type="submit" disabled={busy}>
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                          Save changes
                        </Button>
                      </div>
                    </form>
                  </details>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "muted";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className={`text-2xl font-bold ${
        tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-storm-navy"
      }`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
