import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { BarChart3, Calendar, CheckCircle2, Mail, Settings, Users, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { SchoolAccessCodeSettings } from "@/components/admin/school-access-code-settings";
import { PlatformSupportAccess } from "@/components/admin/platform-support-access";
import { requireAdmin } from "@/lib/auth";
import { getClubs, getEvents, getOpportunities } from "@/lib/data";
import { canAccessSchoolAdmin } from "@/lib/permissions";
import { getSchoolById, getSchoolBySlug, getSchoolPublicUrl } from "@/lib/schools";
import { getSchoolSignupAccess } from "@/lib/school-access";
import { createClient } from "@/lib/supabase/server";
import {
  getActivePlatformSupportSession,
  getPlatformSupportAvailability,
} from "@/lib/support-access";
import { slugify } from "@/lib/utils";

interface AdminSchoolPageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}

async function updateSchoolDetailsAction(formData: FormData) {
  "use server";

  const { profile } = await requireAdmin();
  const schoolId = String(formData.get("school_id") ?? "");
  const currentSlug = String(formData.get("current_slug") ?? "");
  const school = await getSchoolById(schoolId);
  if (!school || !canAccessSchoolAdmin(profile, school.id, school.district_id)) {
    redirect("/admin?error=school_scope_required");
  }

  const supabase = await createClient();
  if (!supabase) redirect(`/admin/schools/${currentSlug}?error=database_required`);

  const canControlWorkspace = profile.role === "super_admin" || profile.role === "district_admin";
  const name = String(formData.get("name") ?? "").trim();
  const requestedSlug = canControlWorkspace
    ? slugify(String(formData.get("slug") ?? "").trim() || name)
    : null;
  const { data, error } = await supabase.rpc("update_school_details", {
    target_school_id: school.id,
    requested_name: name,
    requested_short_name: String(formData.get("short_name") ?? "").trim() || null,
    requested_address: String(formData.get("address") ?? "").trim() || null,
    requested_city: String(formData.get("city") ?? "").trim() || null,
    requested_state: String(formData.get("state") ?? "").trim() || null,
    requested_zip: String(formData.get("zip") ?? "").trim() || null,
    requested_website_url: String(formData.get("website_url") ?? "").trim() || null,
    requested_logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    requested_mascot: String(formData.get("mascot") ?? "").trim() || null,
    requested_primary_color: String(formData.get("primary_color") ?? "").trim() || null,
    requested_secondary_color: String(formData.get("secondary_color") ?? "").trim() || null,
    requested_slug: requestedSlug,
    requested_is_active: canControlWorkspace
      ? formData.get("is_active") === "on"
      : null,
    requested_is_public: canControlWorkspace
      ? formData.get("is_public") === "on"
      : null,
  });
  if (error) {
    console.error("[updateSchoolDetailsAction]", error.message);
    redirect(`/admin/schools/${currentSlug}?error=update_school_failed`);
  }

  const updated = data as { slug?: string } | null;
  const nextSlug = updated?.slug || currentSlug;
  revalidatePath(`/admin/schools/${currentSlug}`);
  revalidatePath(`/admin/schools/${nextSlug}`);
  revalidatePath(`/s/${currentSlug}`);
  revalidatePath(`/s/${nextSlug}`);
  revalidatePath("/admin/districts");
  revalidatePath("/admin/statistics");
  redirect(`/admin/schools/${nextSlug}?updated=school`);
}

export default async function AdminSchoolPage({ params, searchParams }: AdminSchoolPageProps) {
  const { profile } = await requireAdmin();

  const { schoolSlug } = await params;
  const notice = await searchParams;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();
  if (!canAccessSchoolAdmin(profile, school.id, school.district_id)) {
    redirect("/admin?error=school_scope_required");
  }

  const [clubs, opportunities, events, signupAccess] = await Promise.all([
    getClubs({ schoolId: school.id }),
    getOpportunities({ schoolId: school.id }),
    getEvents({ schoolId: school.id, upcoming: true }),
    getSchoolSignupAccess(profile, school.id, school.district_id),
  ]);
  const [supportSession, supportAvailability] = profile.role === "super_admin"
    ? await Promise.all([
        getActivePlatformSupportSession(profile, school.id),
        getPlatformSupportAvailability(),
      ])
    : [null, null];
  const modeLabel = profile.role === "super_admin"
    ? "Platform Admin Mode"
    : profile.role === "district_admin"
      ? "District Admin Mode"
      : "School Admin Mode";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
        <strong>{modeLabel}</strong> — you are managing {school.name} within your authorized scope.
      </div>
      <PageHeader
        title={school.name}
        description={`Selected school workspace: /${school.slug}`}
      >
        <Button variant="outline" asChild>
          <Link href={getSchoolPublicUrl(school)}>Open public school page</Link>
        </Button>
      </PageHeader>

      {notice.updated === "school" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          School details were updated.
        </div>
      )}
      {notice.error === "update_school_failed" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          The school could not be updated. Check the required name, URLs, state, colors, and workspace URL name.
        </div>
      )}

      <details className="mb-8 rounded-2xl border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-storm-navy">
          Edit school details
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {profile.role === "admin"
              ? "Identity, location, branding, and website"
              : "Identity, branding, routing, and availability"}
          </span>
        </summary>
        <form action={updateSchoolDetailsAction} className="grid gap-4 border-t p-5 md:grid-cols-2">
          <input type="hidden" name="school_id" value={school.id} />
          <input type="hidden" name="current_slug" value={school.slug} />
          <label className="block text-sm">
            <span className="font-medium text-foreground">School name</span>
            <input name="name" required defaultValue={school.name} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Short name</span>
            <input name="short_name" defaultValue={school.short_name ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          {(profile.role === "super_admin" || profile.role === "district_admin") && (
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-foreground">Workspace URL name</span>
              <input name="slug" required defaultValue={school.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
              <span className="mt-1 block text-xs text-muted-foreground">
                Changing this updates the school’s public and administrative URLs.
              </span>
            </label>
          )}
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-foreground">Street address</span>
            <input name="address" defaultValue={school.address ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">City</span>
            <input name="city" defaultValue={school.city ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-foreground">State</span>
              <input name="state" defaultValue={school.state ?? ""} maxLength={50} pattern="[A-Za-z][A-Za-z .-]{1,49}" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">ZIP code</span>
              <input name="zip" defaultValue={school.zip ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-foreground">School website</span>
            <input name="website_url" type="url" placeholder="https://www.example.org" defaultValue={school.website_url ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Logo URL</span>
            <input name="logo_url" type="url" placeholder="https://www.example.org/logo.png" defaultValue={school.logo_url ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Mascot</span>
            <input name="mascot" defaultValue={school.mascot ?? ""} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-foreground">Primary color</span>
              <input name="primary_color" placeholder="#123ABC" defaultValue={school.primary_color ?? ""} pattern="#[0-9A-Fa-f]{6}" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Secondary color</span>
              <input name="secondary_color" placeholder="#FFFFFF" defaultValue={school.secondary_color ?? ""} pattern="#[0-9A-Fa-f]{6}" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
          </div>
          {(profile.role === "super_admin" || profile.role === "district_admin") && (
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input name="is_active" type="checkbox" defaultChecked={school.is_active !== false} />
                <span>
                  <strong className="text-foreground">School active</strong>
                  <span className="ml-2 text-muted-foreground">Allow normal use of this workspace.</span>
                </span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input name="is_public" type="checkbox" defaultChecked={school.is_public !== false} />
                <span>
                  <strong className="text-foreground">Publicly listed</strong>
                  <span className="ml-2 text-muted-foreground">Show the school in permitted public listings.</span>
                </span>
              </label>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit">Save school details</Button>
          </div>
        </form>
      </details>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Published clubs" value={clubs.length} icon={Users} />
        <Metric title="Opportunities" value={opportunities.length} icon={Zap} />
        <Metric title="Upcoming events" value={events.length} icon={Calendar} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(profile.role === "super_admin" || profile.role === "district_admin") && (
          <ActionCard
            href={`/admin/schools/${school.slug}/drafts`}
            icon={Users}
            title={profile.role === "super_admin" ? "Inspect club drafts" : "Add clubs"}
            description={
              profile.role === "super_admin"
                ? "Open the recorded, read-only draft inventory during an active support session."
                : "Use a prepared starter or create a custom club for this school."
            }
          />
        )}
        {profile.role === "admin" && (
          <ActionCard href="/manage/clubs/drafts" icon={Users} title="Add clubs" description="Use a prepared starter or create a custom club for your school." />
        )}
        <ActionCard
          href={`/admin/schools/${school.slug}/opportunities`}
          icon={Zap}
          title={profile.role === "super_admin" ? "Inspect opportunities" : "Manage opportunities"}
          description={
            profile.role === "super_admin"
              ? "Open the recorded, read-only opportunity inventory during an active support session."
              : "Create, edit, close, archive, or preview this school’s opportunities."
          }
        />
        <ActionCard href={`/s/${school.slug}/calendar`} icon={Calendar} title="Preview calendar" description="View this school’s calendar entries." />
        <ActionCard href={`/admin/users?school=${school.slug}`} icon={Settings} title="Users and roles" description="Assign school admins, teachers, and students for this school." />
        <ActionCard href={`/admin/statistics?school=${school.slug}`} icon={BarChart3} title="Statistics" description="Review school participation and active-club trends." />
        {profile.role === "super_admin" && (
          <ActionCard href="/manage/email-outbox" icon={Mail} title="Email status" description="Review controlled important and urgent email records." />
        )}
      </div>

      <div className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-semibold text-storm-navy">Setup checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Confirm school details",
            "Create or review clubs",
            "Publish clubs that are ready",
            "Create dated club meetings as events",
            "Assign Advisors and student leaders",
            "Add initial opportunities",
            "Test student signup and join flow",
            "Share launch link",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-storm-electric" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SchoolAccessCodeSettings
          schoolId={school.id}
          schoolName={school.name}
          initialCode={signupAccess?.access_code ?? null}
          initialRotatedAt={signupAccess?.rotated_at ?? null}
        />
        <SignupDomainSettings
          schoolId={school.id}
          schoolName={school.name}
          domains={school.allowed_email_domains ?? []}
        />
      </div>
      {profile.role === "super_admin" && supportAvailability && (
        <div className="mt-6">
          <PlatformSupportAccess
            schoolId={school.id}
            schoolName={school.name}
            schoolSlug={school.slug}
            initialSession={supportSession}
            supportAvailable={supportAvailability.available}
          />
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Icon className="mb-3 h-5 w-5 text-storm-electric" />
      <p className="text-2xl font-bold text-storm-navy">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

function ActionCard({ href, icon: Icon, title, description }: { href: string; icon: typeof Users; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-electric/10">
            <Icon className="h-5 w-5 text-storm-electric" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
