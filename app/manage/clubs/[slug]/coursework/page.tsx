import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ClubCreateNavigation } from "@/components/manage/club-create-navigation";
import { AssignmentCard } from "@/components/coursework/assignment-card";
import { AssignmentForm } from "@/components/coursework/assignment-form";
import { AssignmentStatusActions } from "@/components/coursework/assignment-status-actions";
import {
  getClubAssignments,
  getClubAssignmentSubmissionStatuses,
  getManagedClubBySlug,
} from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { canGradeClubCoursework, canManageClubCoursework, canPublishClubCoursework } from "@/lib/permissions";
import { getSchoolById } from "@/lib/schools";
import { getActivePlatformSupportSession, recordPlatformSupportAccess } from "@/lib/support-access";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";

interface CourseworkPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageCourseworkPage({ params }: CourseworkPageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership, readOnlySupport } = await requireClubManager(club);
  if (!readOnlySupport && !canManageClubCoursework(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}?error=coursework_permission_required`);
  }
  const canPublish = canPublishClubCoursework(profile, club, membership);
  const canGrade = canGradeClubCoursework(profile, club, membership);
  const isPlatformSupport = readOnlySupport;
  const [supportSession, supportSchool] = isPlatformSupport
    ? await Promise.all([
      getActivePlatformSupportSession(profile, club.school_id),
      getSchoolById(club.school_id),
    ])
    : [null, null];
  const supportAccessRecorded = supportSession
    ? await recordPlatformSupportAccess({
      actor: profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "club_coursework",
      resourceId: club.id,
    })
    : false;
  const canViewSubmissionCounts = !isPlatformSupport || supportAccessRecorded;

  const assignments = await getClubAssignments(club.id);
  const submissionSets = canViewSubmissionCounts
    ? await Promise.all(
      assignments.map((assignment) => getClubAssignmentSubmissionStatuses(assignment.id))
    )
    : [];
  const assignmentsWithCounts = assignments.map((assignment, index) => {
    const statuses = submissionSets[index];
    if (!statuses) return assignment;
    return {
      ...assignment,
      submission_count: statuses.filter((entry) => Boolean(entry.submission_id)).length,
      returned_count: statuses.filter((entry) => entry.submission_status === "returned").length,
    };
  });
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {supportSession && supportSchool && (
        <PlatformSupportExpiryGuard
          expiresAt={supportSession.expires_at}
          returnTo={`/admin/schools/${supportSchool.slug}/support`}
        />
      )}
      <PageHeader
        title={`Coursework — ${club.name}`}
        description={
          canGrade
            ? "Create assignments, review student work, and return grades and private feedback."
            : "Create coursework and track who has submitted. Private work requires the Advisor, a scoped school administrator, or a recorded support session."
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}/member?view=classwork`}>
            <Eye className="h-4 w-4" /> Student view
          </Link>
        </Button>
      </PageHeader>

      {isPlatformSupport && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {supportAccessRecorded
                  ? "Read-only support session"
                  : supportSession
                    ? "Submission activity stayed locked because access could not be recorded"
                    : "A support session is required for submission activity"}
              </p>
              <p className="mt-1">
                {supportAccessRecorded
                  ? "This view is recorded. Assignment, material, grade, and submission changes are disabled."
                  : supportSession
                    ? "Private information is never shown when the required support audit entry cannot be created. Return to school support and try again."
                    : "Assignment titles remain visible, but student submission counts and private work stay hidden until temporary access is started."}
              </p>
            </div>
          </div>
          {!supportAccessRecorded && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={supportSchool
                ? `/admin/schools/${supportSchool.slug}#support-access`
                : "/admin/schools"}>
                Open school support
              </Link>
            </Button>
          )}
        </div>
      )}

      {!isPlatformSupport && (
        <>
          <ClubCreateNavigation clubSlug={slug} activeType="assignment" />
          <AssignmentForm clubSlug={slug} canPublish={canPublish} />
        </>
      )}

      <section className={isPlatformSupport ? "mt-6" : "mt-10"}>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-storm-navy">Assignments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {assignmentsWithCounts.length} assignment{assignmentsWithCounts.length === 1 ? "" : "s"} in this club
            </p>
          </div>
        </div>

        {assignmentsWithCounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <p className="font-medium text-storm-navy">No assignments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPlatformSupport
                ? "There is no coursework to inspect in this club."
                : "Use the assignment form above to publish the first piece of classwork."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {assignmentsWithCounts.map((assignment) => (
              <div key={assignment.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <AssignmentCard
                  assignment={assignment}
                  href={`/manage/clubs/${slug}/coursework/${assignment.id}`}
                  managerView
                />
                <div className="flex flex-col gap-3 border-t bg-storm-light/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  {typeof assignment.submission_count === "number" ? (
                    <p className="text-xs text-muted-foreground">
                      {assignment.returned_count} graded · {assignment.submission_count} turned in
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Private counts hidden
                    </p>
                  )}
                  {canPublish && (
                    <AssignmentStatusActions
                      clubSlug={slug}
                      assignmentId={assignment.id}
                      status={assignment.status}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
