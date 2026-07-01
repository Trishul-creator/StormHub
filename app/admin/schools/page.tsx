import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowRight, Building2, Calendar, GraduationCap, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSchools, getSchoolManageUrl, getSchoolPublicUrl } from "@/lib/schools";
import { slugify } from "@/lib/utils";
import type { School } from "@/types/database";

async function createSchoolAction(formData: FormData) {
  "use server";

  const { profile } = await requireAuth("/admin/schools");
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const admin = createAdminClient();
  if (!admin) redirect("/admin/schools?error=service_role_required");

  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("short_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const mascot = String(formData.get("mascot") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);

  if (!name || !slug) redirect("/admin/schools?error=missing_school_name");

  const { data: school, error } = await admin
    .from("schools")
    .insert({
      name,
      slug,
      short_name: shortName || null,
      city: city || null,
      state: state || null,
      mascot: mascot || null,
      is_active: true,
      is_public: true,
    })
    .select("id")
    .single();

  if (error || !school) {
    console.error("[createSchoolAction]", error?.message);
    redirect("/admin/schools?error=create_failed");
  }

  await admin.from("school_settings").upsert(
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
  const { profile } = await requireAuth("/admin/schools");
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const schools = await getAllSchools();
  const stats = await getSchoolStats(schools.map((school) => school.id));

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Platform Admin"
        description="Choose a school workspace before viewing or managing school-specific content."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {schools.map((school) => {
            const schoolStats = stats[school.id] ?? emptySchoolStats;
            return (
              <SchoolWorkspaceCard key={school.id} school={school} stats={schoolStats} />
            );
          })}
          {schools.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No schools found</CardTitle>
                <CardDescription>Create the first school workspace to continue.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <form action={createSchoolAction} className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-storm-navy">Create school workspace</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">School name</span>
              <input name="name" required className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Example High School" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Slug</span>
              <input name="slug" className="mt-1 w-full rounded-md border px-3 py-2" placeholder="example-high" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Short name</span>
              <input name="short_name" className="mt-1 w-full rounded-md border px-3 py-2" placeholder="EHS" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">City</span>
                <input name="city" className="mt-1 w-full rounded-md border px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">State</span>
                <input name="state" className="mt-1 w-full rounded-md border px-3 py-2" maxLength={2} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground">Mascot</span>
              <input name="mascot" className="mt-1 w-full rounded-md border px-3 py-2" />
            </label>
            <Button type="submit" className="w-full">Create school</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const emptySchoolStats = {
  clubs: 0,
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
    admin.from("clubs").select("school_id").in("school_id", schoolIds),
    admin.from("profiles").select("school_id").in("school_id", schoolIds).eq("role", "student"),
    admin.from("opportunities").select("school_id").in("school_id", schoolIds).eq("status", "approved"),
    admin
      .from("events")
      .select("school_id")
      .in("school_id", schoolIds)
      .eq("status", "approved")
      .gte("starts_at", new Date().toISOString()),
  ]);

  for (const row of clubs.data ?? []) stats[row.school_id as string].clubs++;
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
              /{school.slug} · {[school.city, school.state].filter(Boolean).join(", ") || "Location not set"} ·{" "}
              {school.is_active === false ? "Inactive" : "Active"} · {school.is_public === false ? "Private" : "Public"}
            </CardDescription>
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
        <div className="grid gap-3 sm:grid-cols-4">
          <SmallStat icon={Users} label="Clubs" value={stats.clubs} />
          <SmallStat icon={GraduationCap} label="Students" value={stats.students} />
          <SmallStat icon={Building2} label="Opportunities" value={stats.opportunities} />
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
