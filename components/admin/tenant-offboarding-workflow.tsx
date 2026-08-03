"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArchiveX, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cancelTenantOffboardingRequest,
  reviewTenantOffboardingRequest,
  submitTenantOffboardingRequest,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  beginAdminReauthentication,
  needsAdminReauthentication,
} from "@/lib/admin-step-up-shared";
import type {
  TenantOffboardingScope,
  TenantOffboardingStatus,
} from "@/types/database";

export type TenantOffboardingScopeOption = {
  scopeType: TenantOffboardingScope;
  scopeId: string;
  label: string;
};

export type TenantOffboardingRequestView = {
  id: string;
  scopeType: TenantOffboardingScope;
  scopeLabel: string;
  status: TenantOffboardingStatus;
  requestReason: string;
  requestedAt: string;
  requestedByLabel: string;
  requestedByUserId: string | null;
  reviewerNotes: string | null;
  exportReference: string | null;
  scheduledPurgeAt: string | null;
  completionReference: string | null;
  allowedTransitions: ReviewStatus[];
  canCancel: boolean;
};

export type ReviewStatus = Exclude<TenantOffboardingStatus, "requested" | "cancelled">;

const reviewTransitions: Partial<Record<TenantOffboardingStatus, ReviewStatus[]>> = {
  requested: ["under_review", "rejected"],
  under_review: ["export_ready", "rejected"],
  export_ready: ["approved", "rejected"],
  approved: ["scheduled"],
  scheduled: ["completed"],
};

export function TenantOffboardingWorkflow({
  scopeOptions,
  requests,
  schemaAvailable,
}: {
  scopeOptions: TenantOffboardingScopeOption[];
  requests: TenantOffboardingRequestView[];
  schemaAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const firstScope = scopeOptions[0]
    ? `${scopeOptions[0].scopeType}:${scopeOptions[0].scopeId}`
    : "";
  const [selectedScope, setSelectedScope] = useState(firstScope);

  function submit() {
    const separator = selectedScope.indexOf(":");
    if (separator < 1) return;
    const scopeType = selectedScope.slice(0, separator) as TenantOffboardingScope;
    const scopeId = selectedScope.slice(separator + 1);
    startTransition(async () => {
      const result = await submitTenantOffboardingRequest({ scopeType, scopeId, reason });
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          beginAdminReauthentication();
          return;
        }
        toast({
          title: "Could not submit offboarding request",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setReason("");
      toast({
        title: "Offboarding request recorded",
        description: "No tenant data was deleted. Continue through the audited review steps below when authorized.",
      });
      router.refresh();
    });
  }

  if (!schemaAvailable) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Tenant offboarding is not available yet
        </p>
        <p className="mt-2 text-sm">
          Apply the tenant offboarding database migration. Requests remain disabled so an
          instruction cannot be lost or handled outside the audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-300 dark:border-amber-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArchiveX className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            <CardTitle>Start a tenant offboarding request</CardTitle>
          </div>
          <CardDescription>
            Platform administrators can record a school or district export/deletion instruction,
            preserve an export, approve it, and schedule the deletion date and time. Submitting
            this first form never deletes, deactivates, or hides tenant data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submit} className="space-y-4">
            <div>
              <Label htmlFor="tenant-offboarding-scope">Tenant scope</Label>
              <select
                id="tenant-offboarding-scope"
                value={selectedScope}
                onChange={(event) => setSelectedScope(event.target.value)}
                required
                disabled={pending || scopeOptions.length === 0}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {scopeOptions.map((option) => (
                  <option
                    key={`${option.scopeType}:${option.scopeId}`}
                    value={`${option.scopeType}:${option.scopeId}`}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tenant-offboarding-reason">Instruction and reason</Label>
              <Textarea
                id="tenant-offboarding-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className="mt-1"
                placeholder="Example: The district contract ends on August 31. Prepare a protected export, then delete covered student and staff data after written approval."
              />
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              This platform-owner workflow requires identity confirmation for every change. The
              deletion date and time is chosen after the protected export is recorded and the
              request is approved. Every transition and evidence reference remains audited.
              StormHub records the schedule but does not perform an automatic physical purge.
            </div>
            <Button
              type="submit"
              disabled={pending || scopeOptions.length === 0 || reason.trim().length < 10}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit protected request
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="offboarding-requests-heading">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-storm-electric" />
          <h2 id="offboarding-requests-heading" className="text-lg font-semibold text-storm-navy">
            Platform offboarding history
          </h2>
        </div>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">No tenant offboarding requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests and their review history will remain available here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <TenantOffboardingRequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TenantOffboardingRequestCard({
  request,
}: {
  request: TenantOffboardingRequestView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const transitions = (reviewTransitions[request.status] ?? []).filter((status) =>
    request.allowedTransitions.includes(status)
  );
  const [nextStatus, setNextStatus] = useState<ReviewStatus | "">(transitions[0] ?? "");
  const [notes, setNotes] = useState("");
  const [exportReference, setExportReference] = useState(request.exportReference ?? "");
  const [scheduledPurgeAt, setScheduledPurgeAt] = useState("");
  const [completionReference, setCompletionReference] = useState("");

  function review() {
    if (!nextStatus) return;
    if (
      nextStatus === "scheduled"
      && (!scheduledPurgeAt || Number.isNaN(Date.parse(scheduledPurgeAt)) || Date.parse(scheduledPurgeAt) <= Date.now())
    ) {
      toast({
        title: "Choose a future deletion date and time",
        description: "The deletion schedule must be later than the current time.",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const normalizedSchedule = scheduledPurgeAt
        ? new Date(scheduledPurgeAt).toISOString()
        : undefined;
      const result = await reviewTenantOffboardingRequest({
        requestId: request.id,
        nextStatus,
        reviewerNotes: notes,
        exportReference,
        scheduledPurgeAt: normalizedSchedule,
        completionReference,
      });
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          beginAdminReauthentication();
          return;
        }
        toast({
          title: "Could not update offboarding request",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Offboarding workflow updated",
        description: nextStatus === "completed"
          ? "Completion evidence was recorded. StormHub did not run an automatic purge."
          : `The request is now ${nextStatus.replaceAll("_", " ")}.`,
      });
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelTenantOffboardingRequest({
        requestId: request.id,
        reason: notes,
      });
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          beginAdminReauthentication();
          return;
        }
        toast({
          title: "Could not cancel offboarding request",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Offboarding request cancelled" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{request.scopeLabel}</CardTitle>
            <CardDescription className="mt-1">
              Requested by {request.requestedByLabel} on{" "}
              {new Date(request.requestedAt).toLocaleString()}
            </CardDescription>
          </div>
          <StatusBadge status={request.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Instruction</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {request.requestReason}
          </p>
        </div>
        {(request.exportReference || request.scheduledPurgeAt || request.completionReference) && (
          <dl className="grid gap-2 rounded-xl border bg-muted/20 p-3 text-sm sm:grid-cols-2">
            {request.exportReference && (
              <div>
                <dt className="font-medium">Protected export reference</dt>
                <dd className="mt-1 break-all text-muted-foreground">{request.exportReference}</dd>
              </div>
            )}
            {request.scheduledPurgeAt && (
              <div>
                <dt className="font-medium">Deletion window</dt>
                <dd className="mt-1 text-muted-foreground">
                  {new Date(request.scheduledPurgeAt).toLocaleString()}
                </dd>
              </div>
            )}
            {request.completionReference && (
              <div>
                <dt className="font-medium">Completion evidence</dt>
                <dd className="mt-1 break-all text-muted-foreground">
                  {request.completionReference}
                </dd>
              </div>
            )}
          </dl>
        )}
        {request.reviewerNotes && (
          <div>
            <p className="text-sm font-medium">Latest review note</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {request.reviewerNotes}
            </p>
          </div>
        )}

        {(transitions.length > 0 || request.canCancel) && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor={`offboarding-notes-${request.id}`}>
                {transitions.length > 0 ? "Review notes" : "Cancellation reason"}
              </Label>
              <Textarea
                id={`offboarding-notes-${request.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1"
              />
            </div>
            {transitions.length > 0 && (
              <>
                <div>
                  <Label htmlFor={`offboarding-status-${request.id}`}>Next status</Label>
                  <select
                    id={`offboarding-status-${request.id}`}
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as ReviewStatus)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:w-72"
                  >
                    {transitions.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                {nextStatus === "export_ready" && (
                  <div>
                    <Label htmlFor={`offboarding-export-${request.id}`}>
                      Protected export or preservation reference
                    </Label>
                    <input
                      id={`offboarding-export-${request.id}`}
                      value={exportReference}
                      onChange={(event) => setExportReference(event.target.value)}
                      required
                      maxLength={1000}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      placeholder="District vault ticket or encrypted export record"
                    />
                  </div>
                )}
                {nextStatus === "scheduled" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                    <Label htmlFor={`offboarding-window-${request.id}`}>
                      Deletion date and time
                    </Label>
                    <input
                      id={`offboarding-window-${request.id}`}
                      type="datetime-local"
                      value={scheduledPurgeAt}
                      onChange={(event) => setScheduledPurgeAt(event.target.value)}
                      required
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:w-72"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Choose the exact future time recorded in the offboarding schedule. This does
                      not automatically purge the tenant.
                    </p>
                  </div>
                )}
                {nextStatus === "completed" && (
                  <div>
                    <Label htmlFor={`offboarding-completion-${request.id}`}>
                      Deletion evidence reference
                    </Label>
                    <input
                      id={`offboarding-completion-${request.id}`}
                      value={completionReference}
                      onChange={(event) => setCompletionReference(event.target.value)}
                      required
                      minLength={20}
                      maxLength={1000}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      placeholder="Operator ticket, deletion report, or verification record"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only use this after an authorized operator completes and verifies the
                      offboarding runbook. This button does not delete data.
                    </p>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={review}
                  disabled={
                    pending
                    || !nextStatus
                    || (nextStatus === "rejected" && notes.trim().length < 10)
                    || (nextStatus === "export_ready" && exportReference.trim().length === 0)
                    || (
                      nextStatus === "scheduled"
                      && (
                        scheduledPurgeAt.length === 0
                        || Number.isNaN(Date.parse(scheduledPurgeAt))
                        || Date.parse(scheduledPurgeAt) <= Date.now()
                      )
                    )
                    || (nextStatus === "completed" && completionReference.trim().length < 20)
                  }
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {nextStatus === "scheduled"
                    ? "Schedule deletion"
                    : nextStatus === "completed"
                      ? "Record completed deletion"
                      : "Record review step"}
                </Button>
              </>
            )}
            {request.canCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={pending || notes.trim().length < 10}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel request
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
