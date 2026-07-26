import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getAdminAnalytics, getPendingApprovals } from "@/lib/data";
import { ArrowRight, CheckSquare2, Users } from "lucide-react";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  if (profile.role === "super_admin") redirect("/admin/schools");
  const [analytics, pendingApprovals] = await Promise.all([getAdminAnalytics(), getPendingApprovals()]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Administration overview"
        description="A school-scoped operational snapshot. Use the administration menu above for statistics, users, moderation, and audit history."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetric label="Pending approvals" value={pendingApprovals.length} />
        <AdminMetric label="Active clubs" value={analytics.activeClubs} />
        <AdminMetric label="Upcoming events" value={analytics.upcomingEvents} />
        <AdminMetric label="Student memberships" value={analytics.totalMemberships} />
        <AdminMetric label="Recent activity" value={analytics.recentActivity.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminAction
          icon={CheckSquare2}
          title="Review content"
          description={`${pendingApprovals.length} item${pendingApprovals.length === 1 ? "" : "s"} currently waiting for review.`}
          href="/admin/content"
          action="Open moderation"
        />
        <AdminAction
          icon={Users}
          title="Manage people"
          description="Review accounts, roles, access status, and school membership."
          href="/admin/users"
          action="Open users & roles"
        />
      </div>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-2xl font-bold text-storm-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function AdminAction({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-storm-navy">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={href}>{action} <ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </section>
  );
}
