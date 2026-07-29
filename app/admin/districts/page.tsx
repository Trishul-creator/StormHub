import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Building2, MapPinned, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getAllDistricts, getDistrictById, getDistrictSchools } from "@/lib/districts";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

async function createDistrictAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=platform_admin_required");
  const admin = createAdminClient();
  if (!admin) redirect("/admin/districts?error=database_required");

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim().toUpperCase();
  const websiteUrl = String(formData.get("website_url") ?? "").trim();
  if (!name || !slug) redirect("/admin/districts?error=missing_district_configuration");

  const { data: district, error } = await admin
    .from("districts")
    .insert({
      name,
      slug,
      city: city || null,
      state: state || null,
      website_url: websiteUrl || null,
      is_active: true,
    })
    .select("slug")
    .single();
  if (error || !district) {
    console.error("[createDistrictAction]", error?.message);
    redirect("/admin/districts?error=create_failed");
  }

  revalidatePath("/admin/districts");
  redirect(`/admin/districts/${district.slug}`);
}

export default async function AdminDistrictsPage() {
  const { profile } = await requireAdmin();
  if (profile.role === "district_admin") {
    if (!profile.district_id) redirect("/admin?error=district_assignment_required");
    const district = await getDistrictById(profile.district_id);
    redirect(district ? `/admin/districts/${district.slug}` : "/admin?error=district_not_found");
  }
  if (profile.role !== "super_admin") redirect("/admin");

  const districts = await getAllDistricts();
  const schoolCounts: Record<string, number> = Object.fromEntries(
    await Promise.all(
      districts.map(async (district) => [
        district.id,
        (await getDistrictSchools(district.id)).length,
      ])
    )
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div data-tour="role-overview">
        <PageHeader
          title="Districts"
          description="Create districts, assign district administrators, and open their school workspaces."
        />
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Platform district summary">
        <div className="rounded-xl border bg-card p-5">
          <MapPinned className="h-5 w-5 text-storm-electric" />
          <p className="mt-3 text-2xl font-bold text-storm-navy">{districts.length}</p>
          <p className="text-sm text-muted-foreground">Districts</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <Building2 className="h-5 w-5 text-storm-electric" />
          <p className="mt-3 text-2xl font-bold text-storm-navy">
            {Object.values(schoolCounts).reduce((total, count) => total + count, 0)}
          </p>
          <p className="text-sm text-muted-foreground">District schools</p>
        </div>
      </section>

      <section aria-labelledby="district-workspaces-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="district-workspaces-title" className="text-lg font-semibold text-storm-navy">
              District workspaces
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform administrators retain access across every district.
            </p>
          </div>
          <details className="group relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create district
            </summary>
            <form
              action={createDistrictAction}
              className="mt-3 space-y-3 rounded-2xl border bg-card p-5 shadow-lg sm:absolute sm:right-0 sm:z-20 sm:w-[400px]"
            >
              <h3 className="font-semibold text-storm-navy">Create district workspace</h3>
              <label className="block text-sm">
                <span className="text-muted-foreground">District name</span>
                <input name="name" required className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="Example Public Schools" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Workspace URL name (optional)</span>
                <input name="slug" className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="example-public-schools" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-muted-foreground">City</span>
                  <input name="city" className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">State</span>
                  <input name="state" maxLength={2} className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-muted-foreground">District website</span>
                <input name="website_url" type="url" className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="https://www.example.org" />
              </label>
              <Button type="submit" className="w-full">Create district</Button>
            </form>
          </details>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="district-workspaces">
          {districts.map((district) => (
            <Link key={district.id} href={`/admin/districts/${district.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
                    <MapPinned className="h-5 w-5" />
                  </div>
                  <CardTitle>{district.name}</CardTitle>
                  <CardDescription>
                    {schoolCounts[district.id] ?? 0} school{schoolCounts[district.id] === 1 ? "" : "s"}
                    {district.state ? ` · ${district.state}` : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
