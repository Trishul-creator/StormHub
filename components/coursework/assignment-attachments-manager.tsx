"use client";

import { useState } from "react";
import { Cloud, Copy, Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  prepareCourseworkFileUpload,
  registerAssignmentGoogleDriveAttachment,
  registerCourseworkFileUpload,
  removeCourseworkAttachment,
} from "@/lib/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { ClubAssignmentAttachment } from "@/types/database";
import { GoogleDrivePicker } from "@/components/coursework/google-drive-picker";

export function AssignmentAttachmentsManager({
  clubSlug,
  assignmentId,
  attachments,
  readOnly = false,
}: {
  clubSlug: string;
  assignmentId: string;
  attachments: ClubAssignmentAttachment[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    const supabase = createBrowserClient();
    if (!supabase || !files.length) return;
    setWorking(true);
    const errors: string[] = [];
    for (const file of files) {
      const prepared = await prepareCourseworkFileUpload({
        clubSlug,
        assignmentId,
        target: "assignment",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
      });
      if (
        !prepared.success
        || !prepared.intentId
        || !prepared.path
        || !prepared.token
        || !prepared.fileName
        || !prepared.mimeType
      ) {
        errors.push(`${file.name}: ${prepared.error || "could not prepare upload"}`);
        continue;
      }
      const { error: uploadError } = await supabase.storage
        .from("coursework-private")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: prepared.mimeType,
        });
      if (uploadError) {
        errors.push(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const registered = await registerCourseworkFileUpload({
        clubSlug,
        assignmentId,
        target: "assignment",
        intentId: prepared.intentId,
        storagePath: prepared.path,
        fileName: prepared.fileName,
        fileSize: file.size,
        mimeType: prepared.mimeType,
      });
      if (!registered.success) errors.push(`${file.name}: ${registered.error || "could not attach file"}`);
    }
    setWorking(false);
    toast(errors.length
      ? { title: "Some files could not be attached", description: errors.join(" "), variant: "destructive" }
      : { title: files.length === 1 ? "Material attached" : "Materials attached" });
    router.refresh();
  }

  async function addDriveFiles(
    files: Array<{ id: string; name: string }>,
    copyMode: "reference" | "student_copy"
  ) {
    setWorking(true);
    const errors: string[] = [];
    for (const file of files) {
      const result = await registerAssignmentGoogleDriveAttachment({
        clubSlug,
        assignmentId,
        fileId: file.id,
        copyMode,
      });
      if (!result.success) errors.push(`${file.name}: ${result.error || "could not attach Drive file"}`);
    }
    setWorking(false);
    toast(errors.length
      ? { title: "Some Drive files could not be attached", description: errors.join(" "), variant: "destructive" }
      : { title: files.length === 1 ? "Drive material attached" : "Drive materials attached" });
    router.refresh();
  }

  async function remove(attachment: ClubAssignmentAttachment) {
    setRemovingId(attachment.id);
    const result = await removeCourseworkAttachment({
      clubSlug,
      assignmentId,
      target: "assignment",
      attachmentId: attachment.id,
    });
    setRemovingId(null);
    if (!result.success) {
      toast({ title: "Could not remove material", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Material removed",
      description: attachment.copy_mode === "student_copy"
        ? "Existing student copies remain in the teacher's Google Drive."
        : undefined,
    });
    router.refresh();
  }

  return (
    <div className="mt-6 border-t pt-5">
      <div>
        <p className="text-sm font-semibold text-storm-navy">Attached materials</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Private uploads are served through authorized links. Student-copy templates generate one private editable copy per student.
        </p>
      </div>
      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 rounded-lg border bg-storm-light/15 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-storm-navy">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.copy_mode === "student_copy"
                    ? "Individual student copies"
                    : attachment.source_type === "google_drive" ? "Google Drive reference" : "Private upload"}
                </p>
              </div>
              <Button size="icon" variant="ghost" asChild aria-label={`Open ${attachment.file_name}`}>
                <a
                  href={attachment.source_type === "upload"
                    ? `/api/coursework/files/assignment/${attachment.id}`
                    : `/api/coursework/google/assignment-attachments/${attachment.id}/open`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {attachment.source_type === "upload"
                    ? <Download className="h-4 w-4" />
                    : <Cloud className="h-4 w-4" />}
                </a>
              </Button>
              {!readOnly && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={working || removingId === attachment.id}
                  aria-label={`Remove ${attachment.file_name}`}
                  onClick={() => remove(attachment)}
                >
                  {removingId === attachment.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {readOnly ? (
        <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
          Read-only support: attached materials cannot be added, replaced, or removed.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild disabled={working}>
              <label className="cursor-pointer">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Upload files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif"
                  className="sr-only"
                  disabled={working}
                  onChange={(event) => {
                    void uploadFiles(Array.from(event.target.files ?? []));
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </Button>
            <GoogleDrivePicker
              returnTo={`/manage/clubs/${clubSlug}/coursework/${assignmentId}`}
              disabled={working}
              label="Add Drive references"
              onPicked={(files) => addDriveFiles(files, "reference")}
            />
            <GoogleDrivePicker
              returnTo={`/manage/clubs/${clubSlug}/coursework/${assignmentId}`}
              disabled={working}
              label="Add student-copy templates"
              showConfigurationHint={false}
              onPicked={(files) => addDriveFiles(files, "student_copy")}
            />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Copy className="h-3.5 w-3.5" /> Student copies support Google Docs, Sheets, Slides, Drawings, and Forms.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Up to 20 approved school-document materials, 20 MB per file and 200 MB total.
          </p>
        </>
      )}
    </div>
  );
}
