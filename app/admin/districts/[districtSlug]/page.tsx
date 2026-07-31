import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Building2, Plus, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getDistrictBySlug, getDistrictSchools } from "@/lib/districts";
import { canAccessDistrictAdmin } from "@/lib/permissions";
import { parseSignupDomainInput } from "@/lib/signup-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSchools } from "@/lib/schools";
import { slugify } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { requireRecentAdminAuthenticationOrRedirect } from "@/lib/admin-step-up";

interface DistrictPageProps {
  params: Promise<{ districtSlug: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}

async function updateDistrictDetailsAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  const districtId = String(formData.get("district_id") ?? "");
  const currentSlug = String(formData.get("current_slug") ?? "");
  if (!canAccessDistrictAdmin(profile, districtId)) {
    redirect("/admin?error=district_scope_required");
  }
  await requireRecentAdminAuthenticationOrRedirect(
    `/admin/districts/${currentSlug}`,
    undefined,
    profile.id
  );

  const supabase = await createClient();
  if (!supabase) {
    redirect(`/admin/districts/${currentSlug}?error=database_required`);
  }

  const canControlDistrict = profile.role === "super_admin";
  const name = String(formData.get("name") ?? "").trim();
  const requestedSlug = canControlDistrict
    ? slugify(String(formData.get("slug") ?? "").trim() || name)
    : null;
  const { data, error } = await supabase.rpc("update_district_details", {
    target_district_id: districtId,
    requested_name: name,
    requested_city: String(formData.get("city") ?? "").trim() || null,
    requested_state: String(formData.get("state") ?? "").trim() || null,
    requested_website_url: String(formData.get("website_url") ?? "").trim() || null,
    requested_slug: requestedSlug,
    requested_is_active: canControlDistrict
      ? formData.get("is_active") === "on"
      : null,
  });
  if (error) {
    console.error("[updateDistrictDetailsAction]", error.message);
    redirect(`/admin/districts/${currentSlug}?error=update_district_failed`);
  }

  const updated = data as { slug?: string } | null;
  const nextSlug = updated?.slug || currentSlug;
  revalidatePath("/admin/districts");
  revalidatePath(`/admin/districts/${currentSlug}`);
  revalidatePath(`/admin/districts/${nextSlug}`);
  revalidatePath("/admin/statistics");
  redirect(`/admin/districts/${nextSlug}?updated=district`);
}

async function createDistrictSchoolAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  const districtId = String(formData.get("district_id") ?? "");
  const districtSlug = String(formData.get("district_slug") ?? "");
  if (!canAccessDistrictAdmin(profile, districtId)) {
    redirect("/admin?error=district_scope_required");
  }
  await requireRecentAdminAuthenticationOrRedirect(
    `/admin/districts/${districtSlug}`,
    undefined,
    profile.id
  );
  const admin = createAdminClient();
  if (!admin) redirect(`/admin/districts/${districtSlug}?error=database_required`);

  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("short_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim().toUpperCase();
  const mascot = String(formData.get("mascot") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  const {
    domains: allowedEmailDomains,
    invalidDomains,
  } = parseSignupDomainInput(String(formData.get("allowed_email_domains") ?? ""));
  if (
    !name
    || !slug
    || allowedEmailDomains.length === 0
    || invalidDomains.length > 0
    || (allowedEmailDomains.includes("*") && allowedEmailDomains.length > 1)
  ) {
    redirect(`/admin/districts/${districtSlug}?error=missing_school_configuration`);
  }

  const { error } = await admin.from("schools").insert({
    district_id: districtId,
    name,
    slug,
    short_name: shortName || null,
    city: city || null,
    state: state || null,
    mascot: mascot || null,
    allowed_email_domains: allowedEmailDomains,
    is_active: true,
    is_public: true,
  });
  if (error) {
    console.error("[createDistrictSchoolAction]", error.message);
    redirect(`/admin/districts/${districtSlug}?error=create_school_failed`);
  }

  revalidatePath(`/admin/districts/${districtSlug}`);
}

async function attachExistingSchoolAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=platform_admin_required");
  const districtId = String(formData.get("district_id") ?? "");
  const districtSlug = String(formData.get("district_slug") ?? "");
  const schoolId = String(formData.get("school_id") ?? "");
  await requireRecentAdminAuthenticationOrRedirect(
    `/admin/districts/${districtSlug}`,
    undefined,
    profile.id
  );
  const admin = createAdminClient();
  if (!admin || !districtId || !schoolId) {
    redirect(`/admin/districts/${districtSlug}?error=missing_school_assignment`);
  }

  const { error } = await admin
    .from("schools")
    .update({ district_id: districtId })
    .eq("id", schoolId)
    .is("district_id", null);
  if (error) {
    console.error("[attachExistingSchoolAction]", error.message);
    redirect(`/admin/districts/${districtSlug}?error=assign_school_failed`);
  }

  revalidatePath(`/admin/districts/${districtSlug}`);
  revalidatePath("/admin/districts");
}

export default async function DistrictPage({ params, searchParams }: DistrictPageProps) {
  const { profile } = await requireAdmin();
  const { districtSlug } = await params;
  const notice = await searchParams;
  const district = await getDistrictBySlug(districtSlug);
  if (!district) notFound();
  if (!canAccessDistrictAdmin(profile, district.id)) {
    redirect("/admin?error=district_scope_required");
  }

  const schools = await getDistrictSchools(district.id);
  const unassignedSchools = profile.role === "super_admin"
    ? (await getAllSchools()).filter((school) => !school.district_id)
    : [];
  const admin = createAdminClient();
  const { data: managerRows } = admin
    ? await admin
        .from("profiles")
        .select("*")
        .eq("district_id", district.id)
        .eq("role", "district_admin")
        .order("full_name")
    : { data: [] };
  const managers = (managerRows as Profile[] | null) ?? [];

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
        <strong>{profile.role === "super_admin" ? "Platform Admin Mode" : "District Admin Mode"}</strong>
        {" — "}
        you are managing {district.name}.
      </div>
      <div data-tour="role-overview">
        <PageHeader
          title={district.name}
          description={`${schools.length} school workspace${schools.length === 1 ? "" : "s"} in this district.`}
        >
          {profile.role === "super_admin" && (
            <Button variant="outline" asChild>
              <Link href="/admin/districts">All districts</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/admin/statistics?district=${encodeURIComponent(district.slug)}`}>
              District-wide statistics
            </Link>
          </Button>
        </PageHeader>
      </div>

      {notice.updated === "district" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          District details were updated.
        </div>
      )}
      {notice.error === "update_district_failed" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          The district could not be updated. Check the name, state, website URL, and URL name, then try again.
        </div>
      )}

      <details className="mb-8 rounded-2xl border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-storm-navy">
          Edit district details
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {profile.role === "super_admin"
              ? "Identity, routing, and availability"
              : "Name, location, and website"}
          </span>
        </summary>
        <form action={updateDistrictDetailsAction} className="grid gap-4 border-t p-5 md:grid-cols-2">
          <input type="hidden" name="district_id" value={district.id} />
          <input type="hidden" name="current_slug" value={district.slug} />
          <label className="block text-sm">
            <span className="font-medium text-foreground">District name</span>
            <input
              name="name"
              required
              defaultValue={district.name}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
            />
          </label>
          {profile.role === "super_admin" && (
            <label className="block text-sm">
              <span className="font-medium text-foreground">Workspace URL name</span>
              <input
                name="slug"
                required
                defaultValue={district.slug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium text-foreground">City</span>
            <input
              name="city"
              defaultValue={district.city ?? ""}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">State</span>
            <input
              name="state"
              defaultValue={district.state ?? ""}
              maxLength={50}
              pattern="[A-Za-z][A-Za-z .-]{1,49}"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-foreground">District website</span>
            <input
              name="website_url"
              type="url"
              placeholder="https://www.example.org"
              defaultValue={district.website_url ?? ""}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
            />
          </label>
          {profile.role === "super_admin" && (
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm md:col-span-2">
              <input name="is_active" type="checkbox" defaultChecked={district.is_active} />
              <span>
                <strong className="text-foreground">District active</strong>
                <span className="ml-2 text-muted-foreground">
                  Inactive districts remain in platform records but cannot be launched normally.
                </span>
              </span>
            </label>
          )}
          <div className="md:col-span-2">
            <Button type="submit">Save district details</Button>
          </div>
        </form>
      </details>

      <section aria-labelledby="district-schools-title" data-tour="district-schools">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="district-schools-title" className="text-lg font-semibold text-storm-navy">
              Schools
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              New schools created here are automatically attached to {district.name}.
            </p>
          </div>
          <details className="group relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create school
            </summary>
            <form
              action={createDistrictSchoolAction}
              className="mt-3 space-y-3 rounded-2xl border bg-card p-5 shadow-lg sm:absolute sm:right-0 sm:z-20 sm:w-[400px]"
            >
              <input type="hidden" name="district_id" value={district.id} />
              <input type="hidden" name="district_slug" value={district.slug} />
              <h3 className="font-semibold text-storm-navy">Create school in {district.name}</h3>
              <label className="block text-sm">
                <span className="text-muted-foreground">School name</span>
                <input name="name" required className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Approved email domains</span>
                <input name="allowed_email_domains" required className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="* or students.example.edu" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Workspace URL name (optional)</span>
                <input name="slug" className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Short name</span>
                <input name="short_name" className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
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
                <span className="text-muted-foreground">Mascot</span>
                <input name="mascot" className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
              </label>
              <Button type="submit" className="w-full">Create school</Button>
            </form>
          </details>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((school) => (
            <Link key={school.id} href={`/admin/schools/${school.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle>{school.name}</CardTitle>
                  <CardDescription>
                    {[school.city, school.state].filter(Boolean).join(", ") || "Location not set"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {profile.role === "super_admin" && unassignedSchools.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-card p-5" aria-labelledby="attach-school-title">
          <h2 id="attach-school-title" className="font-semibold text-storm-navy">
            Attach an existing independent school
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This moves the school and its existing accounts into {district.name}.
          </p>
          <form action={attachExistingSchoolAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="district_id" value={district.id} />
            <input type="hidden" name="district_slug" value={district.slug} />
            <select
              name="school_id"
              required
              className="h-10 flex-1 rounded-md border bg-background px-3 text-sm text-foreground"
              defaultValue=""
            >
              <option value="" disabled>Select an unassigned school</option>
              {unassignedSchools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
            <Button type="submit">Attach school</Button>
          </form>
        </section>
      )}

      <section className="mt-8 rounded-2xl border bg-card p-5" aria-labelledby="district-admins-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 id="district-admins-title" className="font-semibold text-storm-navy">
                District administrators
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These accounts can manage schools only inside this district.
              </p>
            </div>
          </div>
          {profile.role === "super_admin" && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">Manage roles</Link>
            </Button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {managers.map((manager) => (
            <div key={manager.id} className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
              <Users className="h-4 w-4 text-storm-electric" />
              <span className="font-medium">{manager.full_name || "Unnamed administrator"}</span>
              <span className="text-muted-foreground">{manager.email}</span>
            </div>
          ))}
          {managers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No district administrator is assigned yet. Use the Role control in Users &amp; Roles
              to assign one.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
