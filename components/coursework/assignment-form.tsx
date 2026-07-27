"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileUp, Link as LinkIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createClubAssignment,
  prepareCourseworkFileUpload,
  registerAssignmentGoogleDriveAttachment,
  registerCourseworkFileUpload,
  updateClubAssignmentStatus,
} from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/cn";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  GoogleDrivePicker,
  type PickedGoogleDriveFile,
} from "@/components/coursework/google-drive-picker";

interface DriveAttachmentDraft extends PickedGoogleDriveFile {
  copyMode: "reference" | "student_copy";
}

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
  const [submissionMode, setSubmissionMode] = useState<"submission" | "completion">("submission");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveAttachmentDraft[]>([]);
  const [draftAssignmentId, setDraftAssignmentId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    const form = new FormData(formElement);
    const hasPendingAttachments = localFiles.length > 0 || driveFiles.length > 0;
    let assignmentId = draftAssignmentId;
    if (!assignmentId) {
      const result = await createClubAssignment({
        clubSlug,
        title: String(form.get("title") ?? ""),
        instructions: String(form.get("instructions") ?? ""),
        dueAt: String(form.get("due_at") ?? "") || null,
        pointsPossible: Number(form.get("points_possible") ?? 100),
        attachmentUrl: String(form.get("attachment_url") ?? "") || null,
        submissionMode,
        publishNow: publishNow && !hasPendingAttachments,
      });
      if (!result.success || !result.assignmentId) {
        setLoading(false);
        toast({ title: "Could not create assignment", description: result.error, variant: "destructive" });
        return;
      }
      assignmentId = result.assignmentId;
      if (hasPendingAttachments) setDraftAssignmentId(assignmentId);
    }

    const errors: string[] = [];
    const uploadedLocalFiles = new Set<File>();
    const registeredDriveFiles = new Set<string>();
    const supabase = createBrowserClient();
    for (const file of localFiles) {
      if (!supabase) {
        errors.push(`${file.name}: private file storage is unavailable.`);
        continue;
      }
      const prepared = await prepareCourseworkFileUpload({
        clubSlug,
        assignmentId,
        target: "assignment",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
      });
      if (!prepared.success || !prepared.path || !prepared.token) {
        errors.push(`${file.name}: ${prepared.error || "could not prepare upload"}`);
        continue;
      }
      const { error: uploadError } = await supabase.storage
        .from("coursework-private")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) {
        errors.push(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const registered = await registerCourseworkFileUpload({
        clubSlug,
        assignmentId,
        target: "assignment",
        storagePath: prepared.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
      });
      if (!registered.success) {
        errors.push(`${file.name}: ${registered.error || "could not attach file"}`);
        continue;
      }
      uploadedLocalFiles.add(file);
    }

    for (const file of driveFiles) {
      const registered = await registerAssignmentGoogleDriveAttachment({
        clubSlug,
        assignmentId,
        fileId: file.id,
        copyMode: file.copyMode,
      });
      if (!registered.success) {
        errors.push(`${file.name}: ${registered.error || "could not attach Drive file"}`);
        continue;
      }
      registeredDriveFiles.add(file.id);
    }

    if (uploadedLocalFiles.size) {
      setLocalFiles((current) => current.filter((file) => !uploadedLocalFiles.has(file)));
    }
    if (registeredDriveFiles.size) {
      setDriveFiles((current) => current.filter((file) => !registeredDriveFiles.has(file.id)));
    }
    if (errors.length) {
      setLoading(false);
      toast({
        title: "Assignment saved as a draft",
        description: `Some attachments still need attention: ${errors.join(" ")}`,
        variant: "destructive",
      });
      router.refresh();
      return;
    }

    if (publishNow && hasPendingAttachments) {
      const published = await updateClubAssignmentStatus({
        clubSlug,
        assignmentId,
        status: "published",
      });
      if (!published.success) {
        setLoading(false);
        toast({
          title: "Attachments saved, but the assignment is still a draft",
          description: published.error,
          variant: "destructive",
        });
        router.refresh();
        return;
      }
    }
    setLoading(false);

    toast({
      title: publishNow ? "Assignment published" : "Draft saved",
      description: publishNow
        ? "Club members can now view and submit this assignment."
        : "Only coursework managers can see this draft.",
    });
    formElement.reset();
    setPublishNow(true);
    setSubmissionMode("submission");
    setLocalFiles([]);
    setDriveFiles([]);
    setDraftAssignmentId(null);
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

      <fieldset>
        <legend className="text-sm font-medium text-storm-navy">How students complete this assignment</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={cn(
            "cursor-pointer rounded-xl border p-4 transition",
            submissionMode === "submission"
              ? "border-storm-electric bg-blue-50/60 dark:bg-blue-950/40"
              : "hover:bg-storm-light/25"
          )}>
            <input
              type="radio"
              name="submission_mode"
              value="submission"
              checked={submissionMode === "submission"}
              onChange={() => setSubmissionMode("submission")}
              className="sr-only"
            />
            <span className="block text-sm font-semibold text-storm-navy">Students turn in work</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Accept a response, private file, Google Drive file, or link.
            </span>
          </label>
          <label className={cn(
            "cursor-pointer rounded-xl border p-4 transition",
            submissionMode === "completion"
              ? "border-storm-electric bg-blue-50/60 dark:bg-blue-950/40"
              : "hover:bg-storm-light/25"
          )}>
            <input
              type="radio"
              name="submission_mode"
              value="completion"
              checked={submissionMode === "completion"}
              onChange={() => setSubmissionMode("completion")}
              className="sr-only"
            />
            <span className="block text-sm font-semibold text-storm-navy">Students mark it complete</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              No response or attachment is required.
            </span>
          </label>
        </div>
      </fieldset>

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

      <div className="rounded-xl border bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-storm-navy">Assignment materials</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Upload private files or choose files from Google Drive. Google Docs, Sheets, and Slides can become an individual editable copy for every student.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              <FileUp className="h-4 w-4" /> Upload files
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  setLocalFiles((current) => [...current, ...selected]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
          <GoogleDrivePicker
            returnTo={`/manage/clubs/${clubSlug}/coursework`}
            onPicked={(files) => {
              setDriveFiles((current) => {
                const existingIds = new Set(current.map((file) => file.id));
                return [
                  ...current,
                  ...files
                    .filter((file) => !existingIds.has(file.id))
                    .map((file) => ({ ...file, copyMode: "reference" as const })),
                ];
              });
            }}
          />
        </div>

        {(localFiles.length > 0 || driveFiles.length > 0) && (
          <div className="mt-4 space-y-2">
            {localFiles.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border bg-storm-light/15 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-storm-navy">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · private upload</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setLocalFiles((current) => current.filter((item) => item !== file))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {driveFiles.map((file) => {
              const supportsCopies = [
                "application/vnd.google-apps.document",
                "application/vnd.google-apps.spreadsheet",
                "application/vnd.google-apps.presentation",
                "application/vnd.google-apps.drawing",
                "application/vnd.google-apps.form",
              ].includes(file.mimeType ?? "");
              return (
                <div key={file.id} className="rounded-lg border bg-storm-light/15 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-storm-navy">{file.name}</p>
                      <p className="text-xs text-muted-foreground">Google Drive</p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setDriveFiles((current) => current.filter((item) => item.id !== file.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {supportsCopies && (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white/80 p-2.5">
                      <input
                        type="checkbox"
                        checked={file.copyMode === "student_copy"}
                        onChange={(event) => {
                          setDriveFiles((current) => current.map((item) =>
                            item.id === file.id
                              ? { ...item, copyMode: event.target.checked ? "student_copy" : "reference" }
                              : item
                          ));
                        }}
                        className="mt-0.5 h-4 w-4 accent-storm-electric"
                      />
                      <span className="text-xs leading-relaxed text-storm-navy">
                        Make an individual editable copy for each student. Copies stay in the teacher&apos;s Drive and are shared privately with each student.
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Maximum private upload size: 20 MB per file.</p>
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
