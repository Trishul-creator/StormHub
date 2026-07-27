import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye } from "lucide-react";
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

interface CourseworkPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageCourseworkPage({ params }: CourseworkPageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);
  if (!canManageClubCoursework(profile, club, membership)) {
    redirect(`/manage/clubs/${slug}?error=coursework_permission_required`);
  }
  const canPublish = canPublishClubCoursework(profile, club, membership);
  const canGrade = canGradeClubCoursework(profile, club, membership);

  const assignments = await getClubAssignments(club.id);
  const submissionSets = await Promise.all(
    assignments.map((assignment) => getClubAssignmentSubmissionStatuses(assignment.id))
  );
  const assignmentsWithCounts = assignments.map((assignment, index) => ({
    ...assignment,
    submission_count: submissionSets[index].filter((entry) => Boolean(entry.submission_id)).length,
    returned_count: submissionSets[index].filter((entry) => entry.submission_status === "returned").length,
  }));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={`Coursework — ${club.name}`}
        description={
          canGrade
            ? "Create assignments, review student work, and return grades and private feedback."
            : "Create coursework and track who has submitted. Private work and grades remain visible only to the Advisor."
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${slug}/member?view=classwork`}>
            <Eye className="h-4 w-4" /> Student view
          </Link>
        </Button>
      </PageHeader>

      <ClubCreateNavigation clubSlug={slug} activeType="assignment" />
      <AssignmentForm clubSlug={slug} canPublish={canPublish} />

      <section className="mt-10">
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
              Use the assignment form above to publish the first piece of classwork.
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
                  <p className="text-xs text-muted-foreground">
                    {assignment.returned_count} graded · {assignment.submission_count} turned in
                  </p>
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
