import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare2,
  ClipboardList,
  GraduationCap,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { DashboardPriorityPanel } from "@/components/dashboard/priority-panel";
import { RoleChecklist } from "@/components/dashboard/role-checklist";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireManager } from "@/lib/auth";
import {
  getAdminAnalytics,
  getManageableClubs,
  getManagementDashboardAttention,
  getPendingApprovals,
} from "@/lib/data";
import { buildManagementDashboardPriorities } from "@/lib/dashboard-priorities";
import {
  canAccessManageAnalytics,
  canApproveContent,
} from "@/lib/permissions";
import { getRoleOnboardingItems } from "@/lib/product";
import { getSchoolForProfile } from "@/lib/schools";

export default async function ManagePage() {
  const { profile } = await requireManager();
  if (profile.role === "super_admin") redirect("/admin/schools");

  const [pendingApprovals, manageableClubs, analytics, school] =
    await Promise.all([
      canApproveContent(profile) ? getPendingApprovals() : Promise.resolve([]),
      getManageableClubs(profile),
      canAccessManageAnalytics(profile)
        ? getAdminAnalytics()
        : Promise.resolve(null),
      profile.role === "admin"
        ? getSchoolForProfile(profile)
        : Promise.resolve(null),
    ]);
  const attention = await getManagementDashboardAttention(manageableClubs);
  const priorities = buildManagementDashboardPriorities({
    attention,
    approvals: pendingApprovals,
    includeGrading: profile.role === "teacher",
    includeCoursework: profile.role !== "admin",
  });
  const readyToGrade = attention.grading.reduce(
    (total, item) => total + item.submittedCount,
    0
  );
  const checklist = getRoleOnboardingItems(profile.role, {
    joinedClubs: manageableClubs.length,
    officerClubs: profile.role === "student" ? manageableClubs.length : 0,
    manageableClubs: manageableClubs.length,
    pendingApprovals: pendingApprovals.length,
    activeClubs:
      analytics?.activeClubs ??
      manageableClubs.filter((club) => club.status === "active").length,
    recentActivity: analytics?.recentActivity.length ?? 0,
  });
  const isSchoolAdmin = profile.role === "admin";
  const isClubOperator = !isSchoolAdmin;
  const isTeacher = profile.role === "teacher";

  return (
    <main className="container mx-auto px-4 py-8">
      <div data-tour="role-overview">
        <PageHeader
          title={
            isSchoolAdmin
              ? "School management"
              : isTeacher
                ? "Club management"
                : "Club leadership"
          }
          description={
            isSchoolAdmin
              ? "A focused view of school content, clubs, and approvals."
              : isTeacher
              ? "See what needs action across your assigned clubs."
              : "Manage the clubs you lead while keeping your own student work separate."
          }
        />
      </div>

      <DashboardPriorityPanel
        items={priorities}
        allHref={isClubOperator ? "/manage/clubs" : "/manage/approvals"}
        allLabel={isClubOperator ? "Open all clubs" : "Open approvals"}
        description={
          isSchoolAdmin
            ? "Approvals and upcoming activity across your school."
            : isTeacher
            ? "Submissions, deadlines, and events that need attention first."
            : "Upcoming coursework and events across the clubs you lead."
        }
      />

      <section
        className="my-6 grid gap-3 sm:grid-cols-3"
        aria-label="Management summary"
        data-tour="dashboard-summary"
      >
        {isClubOperator ? (
          <>
            <SummaryMetric
              label={isTeacher ? "Assigned clubs" : "Led clubs"}
              value={manageableClubs.length}
              icon={Users}
              href="/manage/clubs"
            />
            <SummaryMetric
              label={isTeacher ? "Ready to grade" : "Published coursework"}
              value={
                isTeacher ? readyToGrade : attention.upcomingAssignments.length
              }
              icon={isTeacher ? GraduationCap : ClipboardList}
              href="/manage/clubs"
            />
            <SummaryMetric
              label="Upcoming events"
              value={attention.upcomingEvents.length}
              icon={CalendarDays}
              href="/calendar"
            />
          </>
        ) : (
          <>
            <SummaryMetric
              label="Pending approvals"
              value={pendingApprovals.length}
              icon={CheckSquare2}
              href="/manage/approvals"
            />
            <SummaryMetric
              label="Active clubs"
              value={analytics?.activeClubs ?? 0}
              icon={Users}
              href="/manage/clubs"
            />
            <SummaryMetric
              label="Upcoming events"
              value={analytics?.upcomingEvents ?? attention.upcomingEvents.length}
              icon={CalendarDays}
              href="/calendar"
            />
          </>
        )}
      </section>

      {isClubOperator ? (
        <section className="rounded-2xl border bg-card p-5 shadow-sm" data-tour="managed-clubs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-storm-navy">Your club workspaces</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a club for coursework, posts, events, or the tools allowed by
                your role.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/manage/clubs">View all</Link>
            </Button>
          </div>
          {manageableClubs.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No clubs are assigned to you yet. A school administrator can add you
              as a club advisor.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {manageableClubs.slice(0, 4).map((club) => (
                <Link
                  key={club.id}
                  href={`/manage/clubs/${club.slug}`}
                  className="group flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-storm-electric/40 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-storm-navy">{club.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {club.category ?? "Club"} · {club.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          <DeepLink
            icon={CheckSquare2}
            title="Content approvals"
            description={`${pendingApprovals.length} item${
              pendingApprovals.length === 1 ? "" : "s"
            } waiting for school review.`}
            href="/manage/approvals"
            action="Review queue"
          />
          <DeepLink
            icon={Settings2}
            title="Administration"
            description="Open statistics, accounts, moderation, and audit history."
            href="/admin"
            action="Open administration"
          />
        </section>
      )}

      <details
        className="group mt-6 overflow-hidden rounded-2xl border bg-card"
        data-tour="role-checklist"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="font-semibold text-storm-navy">Setup and guidance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional checklist and configuration tools.
            </p>
          </div>
          <span className="text-sm font-medium text-storm-electric group-open:hidden">
            Show
          </span>
          <span className="hidden text-sm font-medium text-storm-electric group-open:inline">
            Hide
          </span>
        </summary>
        <div className="space-y-4 border-t p-3 [&>section]:border-0 [&>section]:shadow-none">
          <RoleChecklist
            title={
              isSchoolAdmin
                ? "Admin operating checklist"
                : isTeacher
                  ? "Teacher command checklist"
                  : "Student leadership checklist"
            }
            description={
              isSchoolAdmin
                ? "A quick operational pass before publishing or presenting."
                : isTeacher
                ? "Keep club content and rosters ready for students."
                : "Learn the management tools available to your club role."
            }
            items={checklist}
            progressKey={`role:${profile.role}:${
              profile.onboarding_reset_at ?? profile.created_at ?? "initial"
            }`}
            forceManualProgress={Boolean(profile.onboarding_reset_at)}
          />

          {profile.role === "admin" && school && (
            <details className="overflow-hidden rounded-xl border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-storm-navy">
                Registration email domains
              </summary>
              <div className="border-t p-3">
                <SignupDomainSettings
                  schoolId={school.id}
                  schoolName={school.name}
                  domains={school.allowed_email_domains ?? []}
                />
              </div>
            </details>
          )}
        </div>
      </details>
    </main>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-storm-electric/40 hover:bg-muted/30"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-storm-navy">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function DeepLink({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-storm-navy">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" asChild className="self-start">
        <Link href={href}>
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}
