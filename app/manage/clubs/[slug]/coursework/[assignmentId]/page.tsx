import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  FileCheck2,
  Paperclip,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignmentStatusActions } from "@/components/coursework/assignment-status-actions";
import { GradeSubmissionForm } from "@/components/coursework/grade-submission-form";
import { AssignmentAttachmentsManager } from "@/components/coursework/assignment-attachments-manager";
import {
  getClubAssignment,
  getClubAssignmentSubmissions,
  getClubAssignmentSubmissionStatuses,
  getClubMemberDirectory,
  getManagedClubBySlug,
} from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import {
  canGradeClubCoursework,
  canInspectClubCoursework,
  canManageClubCoursework,
  canPublishClubCoursework,
} from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { getActivePlatformSupportSession, recordPlatformSupportAccess } from "@/lib/support-access";

interface AssignmentReviewPageProps {
  params: Promise<{ slug: string; assignmentId: string }>;
}

export default async function AssignmentReviewPage({ params }: AssignmentReviewPageProps) {
  const { slug, assignmentId } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);
  if (!canManageClubCoursework(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}?error=coursework_permission_required`);
  }
  const canPublish = canPublishClubCoursework(profile, club, membership);
  const canGrade = canGradeClubCoursework(profile, club, membership);
  const supportSession = profile.role === "super_admin"
    ? await getActivePlatformSupportSession(profile, club.school_id)
    : null;
  const canInspect = canInspectClubCoursework(profile, club, membership, Boolean(supportSession));

  const [assignment, submissionStatuses, submissions, directory] = await Promise.all([
    getClubAssignment(assignmentId),
    getClubAssignmentSubmissionStatuses(assignmentId),
    canInspect ? getClubAssignmentSubmissions(assignmentId) : Promise.resolve([]),
    getClubMemberDirectory(club.id),
  ]);
  if (!assignment || assignment.club_id !== club.id) notFound();
  if (supportSession) {
    await recordPlatformSupportAccess({
      actor: profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "coursework_assignment",
      resourceId: assignmentId,
    });
  }

  const studentMembers = directory.filter((member) => member.membership_role !== "sponsor");
  const submittedIds = new Set(
    submissionStatuses
      .filter((entry) => Boolean(entry.submission_id))
      .map((entry) => entry.user_id)
  );
  const missingMembers = studentMembers.filter((member) => !submittedIds.has(member.user_id));
  const returnedCount = submissionStatuses.filter((entry) => entry.submission_status === "returned").length;
  const submittedCount = submissionStatuses.filter((entry) => Boolean(entry.submission_id)).length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-5">
        <Link href={`/manage/clubs/${slug}/coursework`}>
          <ArrowLeft className="h-4 w-4" /> Back to coursework
        </Link>
      </Button>

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-storm-light/70 px-3 py-1 text-xs font-semibold capitalize text-storm-blue">
              {assignment.status}
            </span>
            <span className="text-sm text-muted-foreground">{assignment.points_possible} points</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-storm-navy">{assignment.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {assignment.due_at ? `Due ${formatDateTime(assignment.due_at)}` : "No due date"}
          </p>
        </div>
        {canPublish && (
          <AssignmentStatusActions clubSlug={slug} assignmentId={assignment.id} status={assignment.status} />
        )}
      </div>

      {supportSession && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Read-only support session:</strong> viewing this assignment is recorded.
            Grading and private-content changes remain disabled for platform administrators.
          </p>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Users} label="Assigned" value={studentMembers.length} />
        <SummaryCard
          icon={FileCheck2}
          label={assignment.submission_mode === "completion" ? "Completed" : "Turned in"}
          value={submittedCount}
        />
        <SummaryCard icon={CheckCircle2} label="Graded" value={returnedCount} />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Assignment details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {assignment.instructions || "No additional instructions."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {assignment.due_at && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-storm-light/40 px-3 py-2 text-sm">
                <CalendarClock className="h-4 w-4 text-storm-electric" />
                {formatDateTime(assignment.due_at)}
              </span>
            )}
            {assignment.attachment_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open assignment resource
                </a>
              </Button>
            )}
          </div>
          <AssignmentAttachmentsManager
            clubSlug={slug}
            assignmentId={assignment.id}
            attachments={assignment.attachments ?? []}
          />
        </CardContent>
      </Card>

      {canInspect ? (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-storm-navy">Student work</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scores and feedback are private to each student.
          </p>
        </div>

        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-5">
            {submissions.map((submission) => (
              <article key={submission.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-storm-navy">
                        {submission.student?.full_name || "Club member"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {submission.submitted_at
                          ? `${assignment.submission_mode === "completion" ? "Completed" : "Turned in"} ${formatDateTime(submission.submitted_at)}`
                          : "Draft"}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium capitalize text-emerald-800">
                      {submission.status === "returned"
                        ? "Graded"
                        : assignment.submission_mode === "completion" ? "Completed" : "Turned in"}
                    </span>
                  </div>
                  {submission.submission_text && (
                    <p className="mt-4 whitespace-pre-wrap rounded-xl bg-storm-light/25 p-4 text-sm leading-relaxed">
                      {submission.submission_text}
                    </p>
                  )}
                  {submission.attachment_url && (
                    <Button variant="outline" size="sm" asChild className="mt-4">
                      <a href={submission.attachment_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> Open submitted work
                      </a>
                    </Button>
                  )}
                  {((submission.attachments?.length ?? 0) > 0 || (submission.student_copies?.length ?? 0) > 0) && (
                    <div className="mt-4 rounded-xl border bg-storm-light/15 p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-storm-blue">
                        <Paperclip className="h-3.5 w-3.5" /> Private files
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(submission.student_copies ?? []).map((copy) => (
                          <Button key={copy.id} variant="outline" size="sm" asChild>
                            <a
                              href={`/api/coursework/google/student-copies/${copy.id}/open`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Cloud className="h-4 w-4" /> {copy.file_name}
                            </a>
                          </Button>
                        ))}
                        {(submission.attachments ?? []).map((attachment) => (
                          <Button key={attachment.id} variant="outline" size="sm" asChild>
                            <a
                              href={attachment.source_type === "upload"
                                ? `/api/coursework/files/submission/${attachment.id}`
                                : attachment.external_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {attachment.source_type === "upload"
                                ? <Download className="h-4 w-4" />
                                : <Cloud className="h-4 w-4" />}
                              {attachment.file_name}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {canGrade && (
                  <GradeSubmissionForm
                    clubSlug={slug}
                    assignmentId={assignment.id}
                    submission={submission}
                    pointsPossible={assignment.points_possible}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      ) : (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-storm-navy">Submission tracker</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Presidents and Vice Presidents can track status, but only the Advisor can open
              private work, assign grades, or read private feedback.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {submissionStatuses.map((entry) => (
              <div
                key={entry.user_id}
                className="flex flex-col gap-2 border-b p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-storm-navy">{entry.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.submitted_at ? formatDateTime(entry.submitted_at) : "No submission yet"}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-storm-light/60 px-2.5 py-1 text-xs font-medium capitalize text-storm-blue">
                  {entry.submission_status === "returned"
                    ? "Returned"
                    : entry.submission_id
                      ? assignment.submission_mode === "completion" ? "Completed" : "Turned in"
                      : assignment.submission_mode === "completion" ? "Not completed" : "Not turned in"}
                </span>
              </div>
            ))}
            {submissionStatuses.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No student members yet.</p>
            )}
          </div>
        </section>
      )}

      {missingMembers.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-storm-navy">
            {assignment.submission_mode === "completion" ? "Not completed" : "Not turned in"}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingMembers.map((member) => (
              <span key={member.user_id} className="rounded-full bg-storm-light/60 px-3 py-1.5 text-sm text-storm-blue">
                {member.full_name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-storm-electric">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-storm-navy">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
