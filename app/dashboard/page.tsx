import Link from "next/link";
import { ArrowRight, Bookmark, Bot, Calendar, CheckSquare, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/layout/stat-cards";
import { EmptyState } from "@/components/layout/empty-state";
import {
  getAdminAnalytics,
  getManageableClubs,
  getPendingApprovals,
  getStudentDashboard,
} from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { isAdminRole } from "@/lib/permissions";

export default async function DashboardPage() {
  const { userId, profile } = await requireAuth("/dashboard");
  const manageableClubs = await getManageableClubs(profile);

  if (isAdminRole(profile.role)) {
    const [analytics, pending] = await Promise.all([
      getAdminAnalytics(),
      getPendingApprovals(),
    ]);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-storm-navy">Administrator Dashboard</h1>
        <p className="mt-1 text-muted-foreground">School-wide clubs, users, content, and approvals.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardMetric label="All clubs" value={analytics.totalClubs} icon={Users} />
          <DashboardMetric label="Active clubs" value={analytics.activeClubs} icon={Settings} />
          <DashboardMetric label="Pending approvals" value={pending.length} icon={CheckSquare} />
          <DashboardMetric label="Upcoming events" value={analytics.upcomingEvents} icon={Calendar} />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardLink href="/admin/users" title="Users & roles" description="Assign teachers, admins, and club responsibilities." />
          <DashboardLink href="/manage/clubs" title="Manage clubs" description="Open any club dashboard or roster." />
          <DashboardLink href="/opportunities" title="All opportunities" description="Review every opportunity without student participation actions." />
          <DashboardLink href="/manage/opportunities" title="Create opportunity" description="Publish a new school-wide signup or application." />
          <DashboardLink href="/manage/approvals" title="Approval queue" description="Review student officer submissions." />
          <DashboardLink href="/manage/analytics" title="Analytics" description="View school-wide participation metrics." />
        </div>
      </div>
    );
  }

  if (profile.role === "teacher") {
    const pending = await getPendingApprovals();
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-storm-navy">Teacher Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Manage your assigned clubs, rosters, events, and announcements.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <DashboardMetric label="Assigned clubs" value={manageableClubs.length} icon={Users} />
          {pending.length > 0 && <DashboardMetric label="Pending approvals" value={pending.length} icon={CheckSquare} />}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardLink
            href="/calendar"
            title="Calendar"
            description="View school-wide events and events from your assigned clubs."
          />
          {manageableClubs.map((club) => (
            <DashboardLink
              key={club.id}
              href={`/manage/clubs/${club.slug}`}
              title={club.name}
              description="Manage content, events, resources, and the club roster."
            />
          ))}
        </div>
      </div>
    );
  }

  const dashboard = await getStudentDashboard(userId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-storm-navy">
          {manageableClubs.length ? "Student Officer Dashboard" : "Your Dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">Your clubs, events, and opportunities at a glance.</p>
      </div>

      <div className="mb-8 rounded-xl border bg-storm-light/20 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 text-storm-electric" />
            <div>
              <h2 className="font-semibold text-storm-navy">Need help deciding what to do next?</h2>
              <p className="text-sm text-muted-foreground">
                Ask StormHub Assistant to summarize events, recommend opportunities, or explain club actions.
              </p>
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href="/assistant">Open Assistant</Link>
          </Button>
        </div>
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
        <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-storm-electric" />
          <div>
            <p className="text-2xl font-bold">{dashboard.memberships.length}</p>
            <p className="text-sm text-muted-foreground">Joined clubs</p>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-storm-electric" />
          <div>
            <p className="text-2xl font-bold">{dashboard.upcomingEvents.length}</p>
            <p className="text-sm text-muted-foreground">Upcoming events</p>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
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
          action={<Button variant="ghost" size="sm" asChild><Link href="/my-clubs">View all</Link></Button>}
        >
          {dashboard.memberships.length === 0 ? (
            <EmptyState title="No clubs yet" description="Explore clubs and join to get started." actionLabel="Browse clubs" actionHref="/clubs" />
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
            <p className="text-sm text-muted-foreground">Join clubs to get personalized recommendations.</p>
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

      <div className="mt-8 text-center">
        <Button asChild>
          <Link href="/clubs">Explore more clubs <ArrowRight className="h-4 w-4" /></Link>
        </Button>
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
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
      <Icon className="h-8 w-8 text-storm-electric" />
      <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
    </div>
  );
}

function DashboardLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-white p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-storm-navy">{title}</h2>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
