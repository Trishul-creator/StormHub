import Link from "next/link";
import { CheckCircle2, Clock3, FileCheck2, Lock, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/utils";
import type { ClubAssignment } from "@/types/database";

export function AssignmentCard({
  assignment,
  href,
  managerView = false,
}: {
  assignment: ClubAssignment;
  href: string;
  managerView?: boolean;
}) {
  const now = Date.now();
  const isPastDue = assignment.due_at ? new Date(assignment.due_at).getTime() < now : false;
  const submission = assignment.submission;
  const status = submission?.status === "returned"
    ? "Graded"
      : submission?.status === "submitted"
      ? assignment.submission_mode === "completion" ? "Complete" : "Turned in"
      : assignment.status === "draft"
        ? assignment.scheduled_for ? "Scheduled" : "Draft"
        : assignment.status === "closed"
          ? "Closed"
          : isPastDue
            ? "Past due"
            : "Assigned";
  const StatusIcon = submission?.status === "returned"
    ? CheckCircle2
    : submission?.status === "submitted"
      ? FileCheck2
      : assignment.status === "draft" || assignment.status === "closed"
        ? Lock
        : Clock3;

  return (
    <Link href={href} className="block">
      <Card className="group h-full hover:border-storm-electric/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-storm-electric transition-transform duration-200 group-hover:scale-105">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-storm-navy transition-colors group-hover:text-storm-electric">
                  {assignment.title}
                </h3>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    status === "Graded" || status === "Turned in" || status === "Complete"
                      ? "bg-emerald-100 text-emerald-800"
                      : status === "Past due"
                        ? managerView
                          ? "bg-storm-light/70 text-storm-blue"
                          : "bg-red-100 text-red-800"
                        : status === "Draft" || status === "Scheduled"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-storm-light/70 text-storm-blue"
                  )}
                >
                  <StatusIcon className="h-3 w-3" /> {status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {assignment.instructions || "No additional instructions."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>
                  {assignment.due_at ? `Due ${formatDateTime(assignment.due_at)}` : "No due date"}
                </span>
                {assignment.scheduled_for && assignment.status === "draft" && (
                  <span>Releases {formatDateTime(assignment.scheduled_for)}</span>
                )}
                <span>{assignment.points_possible} points</span>
                {assignment.submission_mode === "completion" && <span>Mark complete</span>}
                {assignment.attachment_url && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Resource
                  </span>
                )}
                {managerView && typeof assignment.submission_count === "number" && (
                  <span>{assignment.submission_count} turned in</span>
                )}
              </div>
              {submission?.status === "returned" && submission.grade_points !== null && submission.grade_points !== undefined && (
                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  {submission.grade_points} / {assignment.points_possible}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
