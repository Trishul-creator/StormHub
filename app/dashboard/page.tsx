import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardPriorityPanel } from "@/components/dashboard/priority-panel";
import { RoleChecklist } from "@/components/dashboard/role-checklist";
import { DashboardCard } from "@/components/layout/stat-cards";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getManageableClubs, getStudentDashboard } from "@/lib/data";
import { buildStudentDashboardPriorities } from "@/lib/dashboard-priorities";
import { getRoleOnboardingItems } from "@/lib/product";

export default async function DashboardPage() {
  const { userId, profile } = await requireAuth("/dashboard");

  if (profile.role === "super_admin") redirect("/admin/schools");
  if (profile.role === "admin" || profile.role === "teacher") redirect("/manage");

  const [dashboard, manageableClubs] = await Promise.all([
    getStudentDashboard(userId),
    getManageableClubs(profile),
  ]);
  const officerMemberships = dashboard.memberships.filter(
    (membership) =>
      membership.role === "officer" || membership.role === "president"
  );
  const priorities = buildStudentDashboardPriorities(dashboard);
  const openAssignments = dashboard.upcomingAssignments.filter(
    (assignment) =>
      !assignment.submission || assignment.submission.status === "draft"
  ).length;
  const checklist = getRoleOnboardingItems("student", {
    joinedClubs: dashboard.memberships.length,
    savedOpportunities: dashboard.savedOpportunities.length,
    rsvpedEvents: dashboard.upcomingEvents.length,
    officerClubs: officerMemberships.length,
  });
  const progressKey = `role:${profile.role}:${
    profile.onboarding_reset_at ?? profile.created_at ?? "initial"
  }:${officerMemberships
    .map((membership) => `${membership.club_id}:${membership.role}`)
    .sort()
    .join(",")}`;

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6" data-tour="role-overview">
        <p className="text-sm font-medium text-storm-electric">
          {manageableClubs.length > 0 ? "Student leader" : "Student"}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-storm-navy">
          {manageableClubs.length > 0 ? "Leadership dashboard" : "Your dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back
          {profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
          Start with what needs attention, then open a section for more detail.
        </p>
      </header>

      <DashboardPriorityPanel
        items={priorities}
        allHref="/calendar"
        allLabel="Open calendar"
        description="Your closest assignment, opportunity, and event deadlines."
      />

      <section
        className="my-6 grid gap-3 sm:grid-cols-3"
        aria-label="Dashboard summary"
        data-tour="dashboard-summary"
      >
        <SummaryMetric
          label="Joined clubs"
          value={dashboard.memberships.length}
          icon={Users}
          href="/my-clubs"
        />
        <SummaryMetric
          label="Open assignments"
          value={openAssignments}
          icon={ClipboardList}
          href="/my-clubs"
        />
        <SummaryMetric
          label="Upcoming events"
          value={dashboard.upcomingEvents.length}
          icon={CalendarDays}
          href="/calendar"
        />
      </section>

      {manageableClubs.length > 0 && (
        <section
          className="mb-6 rounded-2xl border bg-card p-5 shadow-sm"
          data-tour="leadership-overview"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-storm-navy">Leadership tools</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage the clubs you lead without leaving your student dashboard.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/manage/clubs">
                Manage clubs <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div data-tour="student-clubs">
          <DashboardCard
            title="Your clubs"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href={dashboard.memberships.length > 0 ? "/my-clubs" : "/clubs"}>
                  {dashboard.memberships.length > 0 ? "View all" : "Browse"}
                </Link>
              </Button>
            }
          >
            {dashboard.memberships.length === 0 ? (
              <EmptyState
                title="Find your first club"
                description="Browse the school directory to start building your dashboard."
                href="/clubs"
                action="Browse clubs"
              />
            ) : (
              <div className="space-y-2">
                {dashboard.memberships.slice(0, 3).map(
                  (membership) =>
                    membership.club && (
                      <Link
                        key={membership.id}
                        href={`/clubs/${membership.club.slug}/member`}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {membership.club.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {membership.club.category}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    )
                )}
              </div>
            )}
          </DashboardCard>
        </div>

        <DashboardCard
          title="Latest updates"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/notifications">Notifications</Link>
            </Button>
          }
        >
          {dashboard.recentAnnouncements.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-4">
              <Megaphone className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-storm-navy">No new announcements</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Updates from your clubs will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard.recentAnnouncements.slice(0, 3).map((announcement) => (
                <div key={announcement.id} className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-storm-electric">
                    {announcement.club?.name ?? "Club update"}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {announcement.title}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {announcement.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      <details
        className="group mt-6 overflow-hidden rounded-2xl border bg-card"
        open={dashboard.memberships.length === 0}
        data-tour="role-checklist"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="font-semibold text-storm-navy">Getting started</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional setup steps and a quick tour of your tools.
            </p>
          </div>
          <span className="text-sm font-medium text-storm-electric group-open:hidden">
            Show
          </span>
          <span className="hidden text-sm font-medium text-storm-electric group-open:inline">
            Hide
          </span>
        </summary>
        <div className="border-t p-3 [&>section]:border-0 [&>section]:shadow-none">
          <RoleChecklist
            title={
              officerMemberships.length
                ? "New club leader checklist"
                : "Student launch checklist"
            }
            description={
              officerMemberships.length
                ? "Learn the club-leadership tools that are now available to you."
                : "Set up your club feed, saved deadlines, and event plan."
            }
            items={checklist}
            progressKey={progressKey}
            forceManualProgress={
              Boolean(profile.onboarding_reset_at) || officerMemberships.length > 0
            }
          />
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

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
      <div>
        <p className="font-medium text-storm-navy">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" variant="outline" asChild>
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
