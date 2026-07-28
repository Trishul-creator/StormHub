import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckSquare2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardPriorityPanel } from "@/components/dashboard/priority-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminAnalytics,
  getManageableClubs,
  getManagementDashboardAttention,
  getPendingApprovals,
} from "@/lib/data";
import { buildManagementDashboardPriorities } from "@/lib/dashboard-priorities";

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  if (profile.role === "super_admin") redirect("/admin/schools");

  const [analytics, pendingApprovals, manageableClubs] = await Promise.all([
    getAdminAnalytics(),
    getPendingApprovals(),
    getManageableClubs(profile),
  ]);
  const attention = await getManagementDashboardAttention(manageableClubs);
  const priorities = buildManagementDashboardPriorities({
    attention,
    approvals: pendingApprovals,
    includeGrading: false,
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <div data-tour="role-overview">
        <PageHeader
          title="Administration"
          description="School health at a glance, with deeper controls one click away."
        />
      </div>

      <DashboardPriorityPanel
        items={priorities}
        title="Administrative attention"
        description="Content reviews and upcoming school activity."
        allHref="/admin/content"
        allLabel="Open moderation"
      />

      <section
        className="my-6 grid gap-3 sm:grid-cols-3"
        aria-label="Administration summary"
        data-tour="dashboard-summary"
      >
        <AdminMetric
          label="Pending approvals"
          value={pendingApprovals.length}
          icon={CheckSquare2}
          href="/admin/content"
        />
        <AdminMetric
          label="Active clubs"
          value={analytics.activeClubs}
          icon={Users}
          href="/manage/clubs"
        />
        <AdminMetric
          label="Recent activity"
          value={analytics.recentActivity.length}
          icon={Activity}
          href="/admin/statistics"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <AdminAction
          icon={CheckSquare2}
          title="Moderation"
          description="Review pending club content and publishing requests."
          href="/admin/content"
          action="Review content"
        />
        <AdminAction
          icon={Users}
          title="People and roles"
          description="Manage accounts, roles, bans, and school access."
          href="/admin/users"
          action="Manage people"
        />
        <AdminAction
          icon={BarChart3}
          title="Statistics"
          description="Explore adoption, activity, and club health trends."
          href="/admin/statistics"
          action="View statistics"
        />
      </section>
    </main>
  );
}

function AdminMetric({
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

function AdminAction({
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
    <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-semibold text-storm-navy">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" asChild className="mt-4 self-start">
        <Link href={href}>
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}
