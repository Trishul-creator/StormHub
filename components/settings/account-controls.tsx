"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestAccountDeletion } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";

export interface DeletionRequestSummary {
  status: "pending" | "approved" | "rejected" | "completed";
  requested_at: string;
  reviewer_notes?: string | null;
}

export function AccountControls({
  deletionRequest = null,
}: {
  deletionRequest?: DeletionRequestSummary | null;
}) {
  const router = useRouter();
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const activeRequest = submitted || deletionRequest?.status === "pending" || deletionRequest?.status === "approved";

  async function submitDeletionRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE") return;

    setSubmitting(true);
    const result = await requestAccountDeletion(reason);
    setSubmitting(false);

    if (!result.success) {
      toast({
        title: "Could not request deletion",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setSubmitted(true);
    setShowDeleteForm(false);
    setConfirmation("");
    toast({
      title: "Deletion request submitted",
      description: "Your account remains available while an authorized administrator reviews the request.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 transition-[border-color,box-shadow] duration-200 hover:border-storm-electric/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-storm-navy">Download your information</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Export a copy of your profile, memberships, activity, and settings.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <a href="/api/account/export"><Download className="h-4 w-4" /> Export my data</a>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-red-200 bg-red-50/40 transition-shadow duration-200 hover:shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-950">Delete your account</p>
              <p className="mt-1 max-w-xl text-sm text-red-900/75">
                Request permanent removal of your login, profile, memberships, and personal data.
                School-authored records may be retained without your identity.
              </p>
            </div>
          </div>

          {!activeRequest && !showDeleteForm && (
            <Button variant="destructive" className="shrink-0" onClick={() => setShowDeleteForm(true)}>
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
          )}
        </div>

        {activeRequest && (
          <div className="animate-in border-t border-red-200 bg-white/70 p-4 duration-300 fade-in slide-in-from-top-2" role="status">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-storm-navy">Deletion review in progress</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account remains active until an authorized administrator completes the request.
                  You will lose access permanently when deletion is completed.
                </p>
              </div>
            </div>
          </div>
        )}

        {showDeleteForm && !activeRequest && (
          <form
            onSubmit={submitDeletionRequest}
            className="animate-in space-y-4 border-t border-red-200 bg-white/80 p-4 duration-300 fade-in slide-in-from-top-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-storm-navy">Confirm your deletion request</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This request is available to students, teachers, administrators, and super administrators.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cancel account deletion"
                onClick={() => {
                  setShowDeleteForm(false);
                  setConfirmation("");
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <Label htmlFor="deletionReason">Reason (optional)</Label>
              <textarea
                id="deletionReason"
                value={reason}
                maxLength={1000}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-storm-electric/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                placeholder="Tell the reviewer anything they should know"
              />
            </div>

            <div>
              <Label htmlFor="deletionConfirmation">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="deletionConfirmation"
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteForm(false);
                  setConfirmation("");
                }}
              >
                Keep my account
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={confirmation !== "DELETE" || submitting}
              >
                <Trash2 className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit deletion request"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
