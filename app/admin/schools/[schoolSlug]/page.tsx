import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BarChart3, Calendar, CheckCircle2, Mail, Settings, Users, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClubs, getEvents, getOpportunities } from "@/lib/data";
import { getSchoolBySlug, getSchoolPublicUrl } from "@/lib/schools";

interface AdminSchoolPageProps {
  params: Promise<{ schoolSlug: string }>;
}

async function updateSignupDomains(formData: FormData) {
  "use server";
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");
  const schoolId = String(formData.get("school_id") ?? "");
  const schoolSlug = String(formData.get("school_slug") ?? "");
  const domains = String(formData.get("allowed_email_domains") ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain));
  if (!schoolId || !schoolSlug || domains.length === 0) redirect(`/admin/schools/${schoolSlug}?error=invalid_domains`);
  const supabase = await createClient();
  if (!supabase) redirect(`/admin/schools/${schoolSlug}?error=database_required`);
  const { error } = await supabase.from("schools").update({ allowed_email_domains: domains }).eq("id", schoolId);
  if (error) redirect(`/admin/schools/${schoolSlug}?error=update_failed`);
  revalidatePath(`/admin/schools/${schoolSlug}`);
}

export default async function AdminSchoolPage({ params }: AdminSchoolPageProps) {
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [clubs, opportunities, events] = await Promise.all([
    getClubs({ schoolId: school.id }),
    getOpportunities({ schoolId: school.id }),
    getEvents({ schoolId: school.id, upcoming: true }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Platform Admin Mode</strong> — you are managing {school.name}. Super admins are not joined to this school; this is an explicit workspace view.
      </div>
      <PageHeader
        title={school.name}
        description={`Selected school workspace: /${school.slug}`}
      >
        <Button variant="outline" asChild>
          <Link href={getSchoolPublicUrl(school)}>Open public school page</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Published clubs" value={clubs.length} icon={Users} />
        <Metric title="Opportunities" value={opportunities.length} icon={Zap} />
        <Metric title="Upcoming events" value={events.length} icon={Calendar} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard href={`/admin/schools/${school.slug}/drafts`} icon={Users} title="Draft club catalog" description="Review prepared draft clubs before publishing them." />
        <ActionCard href="/manage/opportunities" icon={Zap} title="Manage opportunities" description="Create and review school opportunities." />
        <ActionCard href="/calendar" icon={Calendar} title="Preview calendar" description="View school calendar entries." />
        <ActionCard href={`/admin/users?school=${school.slug}`} icon={Settings} title="Users and roles" description="Assign school admins, teachers, and students for this school." />
        <ActionCard href="/manage/analytics" icon={BarChart3} title="Analytics" description="Review school participation metrics." />
        <ActionCard href="/manage/email-outbox" icon={Mail} title="Email status" description="Review controlled important and urgent email records." />
      </div>

      <div className="mt-8 rounded-xl border bg-white p-5">
        <h2 className="font-semibold text-storm-navy">Setup checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Confirm school details",
            "Create or review clubs",
            "Publish clubs that are ready",
            "Create dated club meetings as events",
            "Assign sponsors and officers",
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

      <form action={updateSignupDomains} className="mt-8 border-t pt-6">
        <input type="hidden" name="school_id" value={school.id} />
        <input type="hidden" name="school_slug" value={school.slug} />
        <h2 className="font-semibold text-storm-navy">Signup protection</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only email addresses from these domains can create accounts in this workspace.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="font-medium">Approved email domains</span>
            <input name="allowed_email_domains" required defaultValue={(school.allowed_email_domains ?? []).join(", ")} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="students.example.edu, staff.example.edu" />
          </label>
          <Button type="submit">Save domains</Button>
        </div>
      </form>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-white p-5">
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
