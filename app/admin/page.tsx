import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getAdminAnalytics, getPendingApprovals } from "@/lib/data";
import { Users, School, FileText, BarChart3, History, UserRoundX } from "lucide-react";
import { redirect } from "next/navigation";

const adminLinks = [
  { href: "/admin/users", icon: Users, title: "Users & Roles", description: "Manage student and staff accounts" },
  { href: "/admin/schools", icon: School, title: "Schools", description: "Manage school workspaces and settings" },
  { href: "/admin/content", icon: FileText, title: "Content Moderation", description: "Review the school-scoped approval queue" },
  { href: "/admin/statistics", icon: BarChart3, title: "Statistics", description: "People, participation, and active-club trends" },
  { href: "/admin/audit", icon: History, title: "Audit Log", description: "Review immutable administrative history" },
  { href: "/admin/deletion-requests", icon: UserRoundX, title: "Deletion Requests", description: "Review account lifecycle requests" },
];

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  if (profile.role === "super_admin") redirect("/admin/schools");
  const [analytics, pendingApprovals] = await Promise.all([getAdminAnalytics(), getPendingApprovals()]);
  const visibleLinks = adminLinks.filter((link) => {
    if (link.href === "/admin/schools") return profile.role === "super_admin";
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Admin Panel" description="School-wide administration for StormHub." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetric label="Pending approvals" value={pendingApprovals.length} />
        <AdminMetric label="Active clubs" value={analytics.activeClubs} />
        <AdminMetric label="Upcoming events" value={analytics.upcomingEvents} />
        <AdminMetric label="Student memberships" value={analytics.totalMemberships} />
        <AdminMetric label="Recent activity" value={analytics.recentActivity.length} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <link.icon className="h-6 w-6 text-storm-electric mb-2" />
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-2xl font-bold text-storm-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
