import Link from "next/link";
import { Shield, Zap, Users, BarChart3, CheckSquare, History, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { RoleChecklist } from "@/components/dashboard/role-checklist";
import { requireManager } from "@/lib/auth";
import { getAdminAnalytics, getManageableClubs, getPendingApprovals } from "@/lib/data";
import { canAccessAdmin, canAccessManageAnalytics, canApproveContent } from "@/lib/permissions";
import { getRoleOnboardingItems } from "@/lib/product";
import { getSchoolForProfile } from "@/lib/schools";
import { redirect } from "next/navigation";

const manageLinks = [
  { href: "/manage/clubs", icon: Users, title: "Manage Clubs", description: "Edit club profiles and view members" },
  { href: "/manage/clubs/drafts", icon: Users, title: "Draft Clubs", description: "Review prepared clubs before publishing them" },
  { href: "/manage/opportunities", icon: Zap, title: "Opportunities", description: "Post school-wide sign-ups and applications" },
  { href: "/manage/approvals", icon: CheckSquare, title: "Approval Queue", description: "Review pending content" },
  { href: "/manage/analytics", icon: BarChart3, title: "Analytics", description: "View platform metrics" },
  { href: "/manage/digest", icon: Mail, title: "Weekly Digest", description: "Generate newsletter content" },
  { href: "/admin", icon: Shield, title: "Admin Panel", description: "School-wide administration" },
  { href: "/admin/audit", icon: History, title: "Audit Log", description: "Review administrative change history" },
];

export default async function ManagePage() {
  const { profile } = await requireManager();
  if (profile.role === "super_admin") redirect("/admin/schools");
  const [pendingApprovals, manageableClubs, analytics, school] = await Promise.all([
    canApproveContent(profile) ? getPendingApprovals() : Promise.resolve([]),
    getManageableClubs(profile),
    canAccessManageAnalytics(profile) ? getAdminAnalytics() : Promise.resolve(null),
    profile.role === "admin" ? getSchoolForProfile(profile) : Promise.resolve(null),
  ]);
  const checklist = getRoleOnboardingItems(profile.role, {
    manageableClubs: manageableClubs.length,
    pendingApprovals: pendingApprovals.length,
    activeClubs: analytics?.activeClubs ?? manageableClubs.filter((club) => club.status === "active").length,
    recentActivity: analytics?.recentActivity.length ?? 0,
  });
  const visibleLinks = manageLinks.filter((link) => {
    if (link.href === "/admin") return canAccessAdmin(profile);
    if (link.href === "/admin/audit") return canAccessAdmin(profile);
    if (link.href === "/manage/opportunities") return canAccessAdmin(profile);
    if (link.href === "/manage/analytics") return canAccessManageAnalytics(profile);
    if (link.href === "/manage/approvals") return canAccessAdmin(profile) || pendingApprovals.length > 0;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Management"
        description="Manage clubs, content, and approvals. Officer and admin tools."
      />
      <div className="mb-6">
        <RoleChecklist
          title={profile.role === "teacher" ? "Teacher command checklist" : "Admin operating checklist"}
          description={profile.role === "teacher" ? "Keep club content and rosters ready for students." : "A quick operational pass before publishing or presenting the app."}
          items={checklist}
        />
      </div>
      {profile.role === "admin" && analytics && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pending approvals" value={pendingApprovals.length} />
          <MetricCard label="Active clubs" value={analytics.activeClubs} />
          <MetricCard label="Upcoming events" value={analytics.upcomingEvents} />
          <MetricCard label="Saved opportunities" value={analytics.totalBookmarks} />
        </div>
      )}
      {profile.role === "admin" && school && (
        <div className="mb-6">
          <SignupDomainSettings
            schoolId={school.id}
            schoolName={school.name}
            domains={school.allowed_email_domains ?? []}
          />
        </div>
      )}
      {profile.role === "teacher" && manageableClubs.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-storm-navy">My clubs command center</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/manage/clubs">View all</Link></Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {manageableClubs.slice(0, 6).map((club) => (
              <Card key={club.id}>
                <CardHeader>
                  <CardTitle className="text-base">{club.name}</CardTitle>
                  <CardDescription>{club.category ?? "Club"} · {club.status.replaceAll("_", " ")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild><Link href={`/manage/clubs/${club.slug}/members`}>Roster</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link href={`/manage/clubs/${club.slug}/announcements`}>Post</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link href={`/manage/clubs/${club.slug}/events`}>Events</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-storm-electric/10 mb-2">
                  <link.icon className="h-5 w-5 text-storm-electric" />
                </div>
                <CardTitle className="text-lg">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-2xl font-bold text-storm-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
