import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionForm } from "@/components/coursework/submission-form";
import {
  getClubAssignment,
  getManagedClubBySlug,
  getUserClubMembership,
} from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { canManageClubCoursework } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

interface AssignmentPageProps {
  params: Promise<{ slug: string; assignmentId: string }>;
}

export default async function ClubAssignmentPage({ params }: AssignmentPageProps) {
  const { slug, assignmentId } = await params;
  const { profile, userId } = await requireAuth(`/clubs/${slug}/member/assignments/${assignmentId}`);
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();

  const membership = await getUserClubMembership(userId, club.id);
  const canManageCoursework = canManageClubCoursework(profile, club, membership);
  if (!membership && !canManageCoursework) {
    redirect(`/clubs/${slug}/member`);
  }

  const assignment = await getClubAssignment(
    assignmentId,
    profile.role === "student" ? userId : null
  );
  if (!assignment || assignment.club_id !== club.id) notFound();

  const submission = assignment.submission;
  const isPastDue = assignment.due_at
    ? new Date(assignment.due_at).getTime() < Date.now()
    : false;
  const canSubmit = profile.role === "student" && Boolean(membership) && assignment.status === "published";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-5">
        <Link href={`/clubs/${slug}/member?view=classwork`}>
          <ArrowLeft className="h-4 w-4" /> Back to classwork
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <main className="min-w-0">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-storm-electric">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{assignment.points_possible} points</span>
                {assignment.status === "closed" && (
                  <span className="rounded-full bg-storm-light px-2.5 py-1 text-xs font-medium text-storm-blue">
                    Closed
                  </span>
                )}
                {isPastDue && assignment.status === "published" && !submission && (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                    Past due
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-bold text-storm-navy">{assignment.title}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                {assignment.due_at ? `Due ${formatDateTime(assignment.due_at)}` : "No due date"}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {assignment.instructions || "No additional instructions."}
              </p>
              {assignment.attachment_url && (
                <Button variant="outline" asChild className="mt-5">
                  <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open assignment resource
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {submission?.status === "returned" && (
            <Card className="mt-6 border-emerald-200 bg-emerald-50/35">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-950">
                  <CheckCircle2 className="h-5 w-5" /> Grade returned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-900">
                  {submission.grade_points ?? "—"}
                  <span className="text-lg font-medium text-emerald-800/70"> / {assignment.points_possible}</span>
                </p>
                {submission.feedback ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-white/70 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                      <MessageSquareText className="h-4 w-4" /> Private feedback
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-emerald-950/75">
                      {submission.feedback}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-emerald-900/70">No written feedback was added.</p>
                )}
              </CardContent>
            </Card>
          )}
        </main>

        <aside>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">
                {canManageCoursework ? "Coursework controls" : "Your work"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canManageCoursework ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Review all student work and return private grades from the management workspace.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/manage/clubs/${slug}/coursework/${assignment.id}`}>
                      Review submissions
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  {submission && (
                    <div className="mb-5 rounded-xl border bg-storm-light/25 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-storm-navy">
                        {submission.status === "returned" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        ) : (
                          <FileCheck2 className="h-4 w-4 text-storm-electric" />
                        )}
                        {submission.status === "returned" ? "Graded" : "Turned in"}
                      </p>
                      {submission.submitted_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(submission.submitted_at)}
                        </p>
                      )}
                    </div>
                  )}
                  <SubmissionForm
                    clubSlug={slug}
                    assignmentId={assignment.id}
                    submission={submission}
                    disabled={!canSubmit}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
