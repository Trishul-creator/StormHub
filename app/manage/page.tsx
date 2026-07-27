import Link from "next/link";
import { ArrowRight, CheckSquare2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { RoleChecklist } from "@/components/dashboard/role-checklist";
import { requireManager } from "@/lib/auth";
import { getAdminAnalytics, getManageableClubs, getPendingApprovals } from "@/lib/data";
import { canAccessManageAnalytics, canApproveContent } from "@/lib/permissions";
import { getRoleOnboardingItems } from "@/lib/product";
import { getSchoolForProfile } from "@/lib/schools";
import { redirect } from "next/navigation";

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
  return (
    <div className="container mx-auto px-4 py-8">
      <div data-tour="role-overview">
        <PageHeader
          title="Management"
          description="Your operational overview. Use the top menu for Clubs, Calendar, Opportunities, and Administration; use the management tools above for approvals and the weekly digest."
        />
      </div>
      <div className="mb-6" data-tour="role-checklist">
        <RoleChecklist
          title={profile.role === "teacher" ? "Teacher command checklist" : "Admin operating checklist"}
          description={profile.role === "teacher" ? "Keep club content and rosters ready for students." : "A quick operational pass before publishing or presenting the app."}
          items={checklist}
          progressKey={`role:${profile.role}:${profile.onboarding_reset_at ?? profile.created_at ?? "initial"}`}
          forceManualProgress={Boolean(profile.onboarding_reset_at)}
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
      {canApproveContent(profile) && pendingApprovals.length > 0 && (
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/70 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <CheckSquare2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-storm-navy">Content needs review</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingApprovals.length} item{pendingApprovals.length === 1 ? " is" : "s are"} waiting in the approval queue.
              </p>
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href="/manage/approvals">Review approvals <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </section>
      )}
      {profile.role === "teacher" && manageableClubs.length > 0 && (
        <section className="mb-6" data-tour="managed-clubs">
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
                <CardContent>
                  <Button size="sm" asChild>
                    <Link href={`/manage/clubs/${club.slug}`}>
                      Open club workspace <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-2xl font-bold text-storm-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
