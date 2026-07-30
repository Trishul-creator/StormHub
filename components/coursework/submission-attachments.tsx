"use client";

import { useState } from "react";
import { Cloud, Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  prepareCourseworkFileUpload,
  registerCourseworkFileUpload,
  registerSubmissionGoogleDriveAttachment,
  removeCourseworkAttachment,
} from "@/lib/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { ClubSubmissionAttachment } from "@/types/database";
import { GoogleDrivePicker } from "@/components/coursework/google-drive-picker";

export function SubmissionAttachments({
  clubSlug,
  assignmentId,
  attachments,
  disabled = false,
}: {
  clubSlug: string;
  assignmentId: string;
  attachments: ClubSubmissionAttachment[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    const supabase = createBrowserClient();
    if (!supabase) {
      toast({ title: "Could not upload files", description: "Private file storage is unavailable.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const errors: string[] = [];
    for (const file of files) {
      const prepared = await prepareCourseworkFileUpload({
        clubSlug,
        assignmentId,
        target: "submission",
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
        target: "submission",
        intentId: prepared.intentId,
        storagePath: prepared.path,
        fileName: prepared.fileName,
        fileSize: file.size,
        mimeType: prepared.mimeType,
      });
      if (!registered.success) {
        errors.push(`${file.name}: ${registered.error || "could not attach file"}`);
      }
    }
    setUploading(false);
    if (errors.length) {
      toast({
        title: "Some files could not be attached",
        description: errors.join(" "),
        variant: "destructive",
      });
    } else {
      toast({ title: files.length === 1 ? "File attached" : "Files attached" });
    }
    router.refresh();
  }

  async function removeAttachment(attachment: ClubSubmissionAttachment) {
    setRemovingId(attachment.id);
    const result = await removeCourseworkAttachment({
      clubSlug,
      assignmentId,
      target: "submission",
      attachmentId: attachment.id,
    });
    setRemovingId(null);
    if (!result.success) {
      toast({ title: "Could not remove attachment", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Attachment removed" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-storm-navy">Private attachments</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Only you and authorized club coursework managers can view these files.
        </p>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 rounded-lg border bg-storm-light/15 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-storm-navy">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.source_type === "google_drive" ? "Google Drive" : "Private upload"}
                </p>
              </div>
              <Button size="icon" variant="ghost" asChild aria-label={`Open ${attachment.file_name}`}>
                <a
                  href={attachment.source_type === "upload"
                    ? `/api/coursework/files/submission/${attachment.id}`
                    : `/api/coursework/google/submission-attachments/${attachment.id}/open`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {attachment.source_type === "google_drive"
                    ? <Cloud className="h-4 w-4" />
                    : <Download className="h-4 w-4" />}
                </a>
              </Button>
              {!disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={removingId === attachment.id}
                  aria-label={`Remove ${attachment.file_name}`}
                  onClick={() => removeAttachment(attachment)}
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

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload files"}
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  void uploadFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
          <GoogleDrivePicker
            returnTo={`/clubs/${clubSlug}/member/assignments/${assignmentId}`}
            disabled={uploading}
            label="Attach from Drive"
            onPicked={async (files) => {
              setUploading(true);
              const warnings: string[] = [];
              const errors: string[] = [];
              for (const file of files) {
                const result = await registerSubmissionGoogleDriveAttachment({
                  clubSlug,
                  assignmentId,
                  fileId: file.id,
                });
                if (!result.success) errors.push(`${file.name}: ${result.error || "could not attach file"}`);
                if (result.warning) warnings.push(result.warning);
              }
              setUploading(false);
              if (errors.length) {
                toast({ title: "Could not attach every Drive file", description: errors.join(" "), variant: "destructive" });
              } else {
                toast({
                  title: files.length === 1 ? "Drive file attached" : "Drive files attached",
                  description: warnings[0],
                });
              }
              router.refresh();
            }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Up to 10 approved school-document attachments, 20 MB per file and 100 MB total.
      </p>
    </div>
  );
}
