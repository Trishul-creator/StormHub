import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSchools } from "@/lib/schools";
import { slugify } from "@/lib/utils";

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

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Schools"
        description="Platform-level school workspaces. Only super admins can create or manage schools."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-storm-light/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">School</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-storm-navy">{school.name}</p>
                    <p className="text-xs text-muted-foreground">{school.short_name || school.mascot || "—"}</p>
                  </td>
                  <td className="p-3 font-mono text-xs">{school.slug}</td>
                  <td className="p-3">{[school.city, school.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-3">{school.is_active === false ? "Inactive" : "Active"}</td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No schools found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
