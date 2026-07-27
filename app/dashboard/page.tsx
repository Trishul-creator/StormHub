import Link from "next/link";
import { ArrowRight, Bookmark, Calendar, CheckSquare, ClipboardList, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleChecklist } from "@/components/dashboard/role-checklist";
import { DashboardCard } from "@/components/layout/stat-cards";
import {
  getAdminAnalytics,
  getManageableClubs,
  getPendingApprovals,
  getStudentDashboard,
} from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { isAdminRole } from "@/lib/permissions";
import { buildDiscoveryHints, getRoleOnboardingItems } from "@/lib/product";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId, profile } = await requireAuth("/dashboard");
  const manageableClubs = await getManageableClubs(profile);

  if (profile.role === "super_admin") redirect("/admin/schools");
  if (isAdminRole(profile.role)) redirect("/manage");

  if (profile.role === "teacher") {
    const pending = await getPendingApprovals();
    const checklist = getRoleOnboardingItems("teacher", {
      manageableClubs: manageableClubs.length,
      pendingApprovals: pending.length,
    });
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-storm-navy">Teacher Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Manage your assigned clubs, coursework, rosters, events, and announcements.</p>
        <div className="mt-6">
          <RoleChecklist
            title="Teacher launch checklist"
            description="The fastest path to keeping club operations current."
            items={checklist}
            progressKey={`role:${profile.role}:${profile.onboarding_reset_at ?? profile.created_at ?? "initial"}`}
            forceManualProgress={Boolean(profile.onboarding_reset_at)}
          />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <DashboardMetric label="Assigned clubs" value={manageableClubs.length} icon={Users} />
          {pending.length > 0 && <DashboardMetric label="Pending approvals" value={pending.length} icon={CheckSquare} />}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardLink
            href="/manage"
            title="My clubs command center"
            description="Review rosters, pending content, quick-post actions, and member status."
          />
          <DashboardLink
            href="/calendar"
            title="Calendar"
            description="View school-wide events and events from your assigned clubs."
          />
          <DashboardLink
            href="/opportunities"
            title="Opportunities"
            description="Browse school opportunities in read-only mode without student signup actions."
          />
          {manageableClubs.map((club) => (
            <DashboardLink
              key={club.id}
              href={`/manage/clubs/${club.slug}`}
              title={club.name}
              description="Manage assignments, grades, posts, events, resources, and the club roster."
            />
          ))}
        </div>
      </div>
    );
  }

  const dashboard = await getStudentDashboard(userId);
  const officerMemberships = dashboard.memberships.filter(
    (membership) => membership.role === "officer" || membership.role === "president"
  );
  const checklist = getRoleOnboardingItems("student", {
    joinedClubs: dashboard.memberships.length,
    savedOpportunities: dashboard.savedOpportunities.length,
    rsvpedEvents: dashboard.upcomingEvents.length,
    officerClubs: officerMemberships.length,
  });
  const firstCategory = dashboard.memberships.find((membership) => membership.club?.category)?.club?.category;
  const discoveryHints = buildDiscoveryHints({
    joinedCategory: firstCategory,
    hasJoinedClubs: dashboard.memberships.length > 0,
    hasSavedOpportunities: dashboard.savedOpportunities.length > 0,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-storm-navy">
          {manageableClubs.length ? "Student Officer Dashboard" : "Your Dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">Your clubs, events, and opportunities at a glance.</p>
      </div>

      <div className="mb-8">
        <RoleChecklist
          title={officerMemberships.length ? "New club leader checklist" : "Student launch checklist"}
          description={
            officerMemberships.length
              ? "Your responsibilities changed, so this checklist starts fresh with your club-leadership tools."
              : "Set up your club feed, saved deadlines, and event plan."
          }
          items={checklist}
          progressKey={`role:${profile.role}:${profile.onboarding_reset_at ?? profile.created_at ?? "initial"}:${officerMemberships
            .map((membership) => `${membership.club_id}:${membership.role}`)
            .sort()
            .join(",")}`}
          forceManualProgress={Boolean(profile.onboarding_reset_at) || officerMemberships.length > 0}
        />
      </div>

      {manageableClubs.length > 0 && (
        <div className="mb-8 rounded-xl border bg-storm-light/20 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-storm-navy">Clubs you manage</h2>
              <p className="text-sm text-muted-foreground">Create club content; teacher or admin review may be required.</p>
            </div>
            <Button size="sm" asChild><Link href="/manage/clubs">Manage</Link></Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="accent-surface-mint rounded-xl border p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-storm-electric" />
          <div>
            <p className="text-2xl font-bold">{dashboard.memberships.length}</p>
            <p className="text-sm text-muted-foreground">Joined clubs</p>
          </div>
        </div>
        <div className="accent-surface-violet rounded-xl border p-4 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-storm-electric" />
          <div>
            <p className="text-2xl font-bold">{dashboard.upcomingEvents.length}</p>
            <p className="text-sm text-muted-foreground">Upcoming events</p>
          </div>
        </div>
        <div className="accent-surface-amber rounded-xl border p-4 flex items-center gap-3">
          <Bookmark className="h-8 w-8 text-storm-electric" />
          <div>
            <p className="text-2xl font-bold">{dashboard.savedOpportunities.length}</p>
            <p className="text-sm text-muted-foreground">Saved opportunities</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <DashboardCard
          title="Your clubs"
          action={dashboard.memberships.length > 0
            ? <Button variant="ghost" size="sm" asChild><Link href="/my-clubs">View all</Link></Button>
            : undefined}
        >
          {dashboard.memberships.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-storm-light/20 p-5">
              <div>
                <p className="font-medium text-storm-navy">No clubs yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Browse the club directory and join one to build your dashboard.</p>
              </div>
              <Button size="sm" asChild><Link href="/clubs">Browse clubs</Link></Button>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.memberships.slice(0, 3).map((m) => m.club && (
                <Link key={m.id} href={`/clubs/${m.club.slug}/member`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-storm-light/30 transition-colors">
                  <div>
                    <p className="font-medium">{m.club.name}</p>
                    <p className="text-xs text-muted-foreground">{m.club.category}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Upcoming classwork">
          {dashboard.upcomingAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No current assignments from your clubs.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.upcomingAssignments.slice(0, 4).map((assignment) => (
                <Link
                  key={assignment.id}
                  href={assignment.club
                    ? `/clubs/${assignment.club.slug}/member/assignments/${assignment.id}`
                    : "/dashboard"}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-storm-light/30"
                >
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-storm-electric" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{assignment.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {assignment.club?.name ?? "Club"} · {assignment.submission ? "Turned in" : assignment.due_at ? `Due ${formatDate(assignment.due_at)}` : "No due date"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Recent announcements">
          {dashboard.recentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Join clubs to see announcements here.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recentAnnouncements.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <p className="text-xs text-storm-electric">{a.club?.name}</p>
                  <p className="font-medium text-sm mt-0.5">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Upcoming events">
          {dashboard.upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events from your clubs.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.upcomingEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.starts_at)}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/events/${e.id}`}>View</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Recommended for you"
          action={<Button variant="ghost" size="sm" asChild><Link href="/opportunities">Explore</Link></Button>}
        >
          {dashboard.recommendedOpportunities.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Join clubs and save opportunities to get stronger recommendations.</p>
              {discoveryHints.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {discoveryHints.map((hint) => (
                    <Button key={hint.href} variant="outline" size="sm" asChild>
                      <Link href={hint.href}>{hint.label}</Link>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.recommendedOpportunities.map((o) => (
                <Link key={o.id} href={`/opportunities/${o.slug}`} className="block rounded-lg border p-3 hover:bg-storm-light/30">
                  <p className="font-medium text-sm">{o.title}</p>
                  <p className="text-xs text-muted-foreground">{o.category}</p>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

    </div>
  );
}

function DashboardMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
      <Icon className="h-8 w-8 text-storm-electric" />
      <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
    </div>
  );
}

function DashboardLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:border-storm-electric/30 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-storm-navy">{title}</h2>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
