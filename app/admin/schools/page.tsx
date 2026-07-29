import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calendar,
  GraduationCap,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DashboardPriorityPanel } from "@/components/dashboard/priority-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSchools, getSchoolManageUrl, getSchoolPublicUrl } from "@/lib/schools";
import { parseSignupDomainInput } from "@/lib/signup-security";
import { slugify } from "@/lib/utils";
import type { School } from "@/types/database";
import type { DashboardPriorityItem } from "@/lib/dashboard-priorities";

async function createSchoolAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const supabase = await createClient();
  if (!supabase) redirect("/admin/schools?error=database_required");

  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("short_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const mascot = String(formData.get("mascot") ?? "").trim();
  const {
    domains: allowedEmailDomains,
    invalidDomains,
  } = parseSignupDomainInput(String(formData.get("allowed_email_domains") ?? ""));
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);

  if (
    !name
    || !slug
    || allowedEmailDomains.length === 0
    || invalidDomains.length > 0
    || (allowedEmailDomains.includes("*") && allowedEmailDomains.length > 1)
  ) {
    redirect("/admin/schools?error=missing_school_configuration");
  }

  const { data: school, error } = await supabase
    .from("schools")
    .insert({
      name,
      slug,
      short_name: shortName || null,
      city: city || null,
      state: state || null,
      mascot: mascot || null,
      allowed_email_domains: allowedEmailDomains,
      is_active: true,
      is_public: true,
    })
    .select("id")
    .single();

  if (error || !school) {
    console.error("[createSchoolAction]", error?.message);
    redirect("/admin/schools?error=create_failed");
  }

  await supabase.from("school_settings").upsert(
    {
      school_id: school.id,
      announcements_enabled: true,
      events_enabled: true,
      resources_enabled: true,
      opportunities_enabled: true,
      volunteering_enabled: false,
      workshops_enabled: false,
      email_sending_enabled: true,
    },
    { onConflict: "school_id" }
  );

  revalidatePath("/admin/schools");
}

export default async function AdminSchoolsPage() {
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const schools = await getAllSchools();
  const stats = await getSchoolStats(schools.map((school) => school.id));
  const totals = Object.values(stats).reduce(
    (current, schoolStats) => ({
      clubs: current.clubs + schoolStats.visibleClubs,
      students: current.students + schoolStats.students,
      events: current.events + schoolStats.events,
    }),
    { clubs: 0, students: 0, events: 0 }
  );
  const priorities = buildSchoolPriorities(schools, stats);

  return (
    <main className="container mx-auto px-4 py-8">
      <div data-tour="role-overview">
        <PageHeader
          title="Platform Admin"
          description="Platform health at a glance. Open a school only when you need its detailed workspace."
        />
      </div>

      <DashboardPriorityPanel
        items={priorities}
        title="Platform attention"
        description="Schools that may need setup or publishing work."
      />

      <section
        className="my-6 grid gap-3 sm:grid-cols-3"
        aria-label="Platform summary"
        data-tour="dashboard-summary"
      >
        <PlatformMetric icon={Building2} label="School workspaces" value={schools.length} />
        <PlatformMetric icon={Users} label="Published clubs" value={totals.clubs} />
        <PlatformMetric icon={GraduationCap} label="Students" value={totals.students} />
      </section>

      <section data-tour="school-workspaces">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-storm-navy">School workspaces</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a school for its clubs, people, and scoped statistics.
            </p>
          </div>
          <details className="group relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create school
            </summary>
            <form
              action={createSchoolAction}
              className="mt-3 rounded-2xl border bg-card p-5 shadow-lg sm:absolute sm:right-0 sm:z-20 sm:w-[380px]"
            >
              <h3 className="font-semibold text-storm-navy">Create school workspace</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A private signup code is generated automatically. Details can be refined later.
              </p>
              <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">School name</span>
              <input name="name" required className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="Example High School" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Approved email domains</span>
              <input name="allowed_email_domains" required className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="* or students.example.edu, staff.example.edu" />
              <span className="mt-1 block text-xs text-muted-foreground">
                Use * for every verified email domain, or enter a comma-separated restriction list.
                The school access code is still required either way.
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Workspace URL name (optional)</span>
              <input name="slug" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="example-high" />
              <span className="mt-1 block text-xs text-muted-foreground">
                This becomes the school link, such as /s/example-high. Leave it blank to generate it from the school name.
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Short name</span>
              <input name="short_name" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="EHS" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">City</span>
                <input name="city" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">State</span>
                <input name="state" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" maxLength={2} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground">Mascot</span>
              <input name="mascot" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" placeholder="Storm" />
              <span className="mt-1 block text-xs text-muted-foreground">Shown on the public school workspace.</span>
            </label>
            <Button type="submit" className="w-full">Create school</Button>
              </div>
            </form>
          </details>
        </div>

        <div className="space-y-4">
          {schools.map((school) => (
            <SchoolWorkspaceCard
              key={school.id}
              school={school}
              stats={stats[school.id] ?? emptySchoolStats}
            />
          ))}
          {schools.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No schools found</CardTitle>
                <CardDescription>
                  Create the first school workspace to continue.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}

const emptySchoolStats = {
  visibleClubs: 0,
  draftClubs: 0,
  students: 0,
  opportunities: 0,
  events: 0,
};

type SchoolStats = typeof emptySchoolStats;

async function getSchoolStats(schoolIds: string[]): Promise<Record<string, SchoolStats>> {
  if (!schoolIds.length) return {};
  const admin = createAdminClient();
  const stats = Object.fromEntries(schoolIds.map((id) => [id, { ...emptySchoolStats }]));
  if (!admin) return stats;

  const [clubs, students, opportunities, events] = await Promise.all([
    admin.from("clubs").select("school_id,status,is_listed,visibility").in("school_id", schoolIds),
    admin.from("profiles").select("school_id").in("school_id", schoolIds).eq("role", "student"),
    admin.from("opportunities").select("school_id").in("school_id", schoolIds).eq("status", "approved"),
    admin
      .from("events")
      .select("school_id")
      .in("school_id", schoolIds)
      .eq("status", "approved")
      .gte("starts_at", new Date().toISOString()),
  ]);

  for (const row of clubs.data ?? []) {
    const schoolStats = stats[row.school_id as string];
    if (!schoolStats) continue;
    if (row.status === "draft") schoolStats.draftClubs++;
    if (row.is_listed === true && row.visibility === "public" && ["interest_open", "active"].includes(String(row.status))) {
      schoolStats.visibleClubs++;
    }
  }
  for (const row of students.data ?? []) stats[row.school_id as string].students++;
  for (const row of opportunities.data ?? []) stats[row.school_id as string].opportunities++;
  for (const row of events.data ?? []) stats[row.school_id as string].events++;

  return stats;
}

function SchoolWorkspaceCard({ school, stats }: { school: School; stats: SchoolStats }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-storm-electric" />
              <CardTitle>{school.name}</CardTitle>
            </div>
            <CardDescription className="mt-1">
              {school.mascot ? `Home of the ${school.mascot} · ` : ""}/{school.slug} · {[school.city, school.state].filter(Boolean).join(", ") || "Location not set"} ·{" "}
              {school.is_active === false ? "Inactive" : "Active"} · {school.is_public === false ? "Private" : "Public"}
            </CardDescription>
            {stats.draftClubs > 0 && (
              <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                {stats.draftClubs} draft club{stats.draftClubs === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={getSchoolPublicUrl(school)}>Open school</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={getSchoolManageUrl(school)}>Manage <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <SmallStat icon={Users} label="Published clubs" value={stats.visibleClubs} />
          <SmallStat icon={GraduationCap} label="Students" value={stats.students} />
          <SmallStat icon={Calendar} label="Upcoming events" value={stats.events} />
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-storm-light/20 p-3">
      <Icon className="mb-2 h-4 w-4 text-storm-electric" />
      <p className="text-lg font-semibold text-storm-navy">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PlatformMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xl font-bold text-storm-navy">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function buildSchoolPriorities(
  schools: School[],
  stats: Record<string, SchoolStats>
): DashboardPriorityItem[] {
  return schools
    .flatMap((school): DashboardPriorityItem[] => {
      const schoolStats = stats[school.id] ?? emptySchoolStats;
      if (school.is_active === false) {
        return [
          {
            id: `school-inactive:${school.id}`,
            kind: "school",
            urgency: "urgent",
            title: `${school.name} is inactive`,
            detail: "Registration and school access may be unavailable.",
            timing: "Needs review",
            href: getSchoolManageUrl(school),
            actionLabel: "Open school",
            score: 0,
          },
        ];
      }
      if (schoolStats.visibleClubs === 0) {
        return [
          {
            id: `school-empty:${school.id}`,
            kind: "school",
            urgency: "soon",
            title: `${school.name} has no published clubs`,
            detail:
              schoolStats.draftClubs > 0
                ? `${schoolStats.draftClubs} draft club${
                    schoolStats.draftClubs === 1 ? "" : "s"
                  } can be reviewed.`
                : "Add or publish clubs before inviting students.",
            timing: "Setup incomplete",
            href: getSchoolManageUrl(school),
            actionLabel: "Open school",
            score: 5,
          },
        ];
      }
      return [];
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, 4);
}
