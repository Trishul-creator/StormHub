"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createStudentGoogleDriveCopy } from "@/lib/actions";
import type {
  ClubAssignmentAttachment,
  ClubAssignmentStudentCopy,
} from "@/types/database";

type CopyState = {
  status: "preparing" | "ready" | "error";
  webUrl?: string;
  error?: string;
};

export function StudentDriveCopies({
  clubSlug,
  assignmentId,
  templates,
  existingCopies,
  disabled = false,
}: {
  clubSlug: string;
  assignmentId: string;
  templates: ClubAssignmentAttachment[];
  existingCopies: ClubAssignmentStudentCopy[];
  disabled?: boolean;
}) {
  const started = useRef(new Set<string>());
  const [states, setStates] = useState<Record<string, CopyState>>(() =>
    Object.fromEntries(templates.map((template) => {
      const existing = existingCopies.find(
        (copy) => copy.assignment_attachment_id === template.id
      );
      return [
        template.id,
        existing
          ? { status: "ready" as const, webUrl: existing.web_url }
          : { status: "preparing" as const },
      ];
    }))
  );

  async function prepareCopy(template: ClubAssignmentAttachment) {
    if (started.current.has(template.id) || disabled) return;
    started.current.add(template.id);
    setStates((current) => ({
      ...current,
      [template.id]: { status: "preparing" },
    }));
    const result = await createStudentGoogleDriveCopy({
      clubSlug,
      assignmentId,
      attachmentId: template.id,
    });
    setStates((current) => ({
      ...current,
      [template.id]: result.success && result.webUrl
        ? { status: "ready", webUrl: result.webUrl }
        : { status: "error", error: result.error || "Could not prepare your copy." },
    }));
  }

  useEffect(() => {
    for (const template of templates) {
      const existing = existingCopies.some(
        (copy) => copy.assignment_attachment_id === template.id
      );
      if (!existing) void prepareCopy(template);
    }
    // Each template is idempotently provisioned once. The server also enforces
    // one copy per student if this component mounts more than once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  if (!templates.length) return null;

  return (
    <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-storm-electric">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-storm-navy">Your Google Drive copies</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Each file is a private editable copy shared only with you and authorized coursework staff.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {templates.map((template) => {
          const state = states[template.id] ?? { status: "preparing" };
          return (
            <div key={template.id} className="rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-storm-navy">{template.file_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {state.status === "preparing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {state.status === "ready" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />}
                    {state.status === "error" && <RefreshCw className="h-3.5 w-3.5 text-amber-700" />}
                    {state.status === "preparing"
                      ? "Preparing your copy..."
                      : state.status === "ready" ? "Ready in Google Drive" : "Copy needs attention"}
                  </p>
                </div>
                {state.status === "ready" && state.webUrl && (
                  <Button size="sm" asChild>
                    <a href={state.webUrl} target="_blank" rel="noopener noreferrer">
                      Open my copy <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {state.status === "error" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      started.current.delete(template.id);
                      void prepareCopy(template);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> Try again
                  </Button>
                )}
              </div>
              {state.status === "error" && (
                <p className="mt-2 text-xs leading-relaxed text-amber-800">{state.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
