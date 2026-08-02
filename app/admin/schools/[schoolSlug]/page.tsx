import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, Calendar, CheckCircle2, Inbox, Mail, Settings, Users, Zap } from "lucide-react";
import { SchoolSettings } from "@/components/admin/organization-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupDomainSettings } from "@/components/admin/signup-domain-settings";
import { SchoolAccessCodeSettings } from "@/components/admin/school-access-code-settings";
import { PlatformSupportAccess } from "@/components/admin/platform-support-access";
import { requireAdmin } from "@/lib/auth";
import { getClubs, getEvents, getOpportunities } from "@/lib/data";
import { canAccessSchoolAdmin } from "@/lib/permissions";
import { getSchoolBySlug, getSchoolPublicUrl } from "@/lib/schools";
import { getSchoolSignupAccess } from "@/lib/school-access";
import {
  getActivePlatformSupportSession,
  getPlatformSupportAvailability,
} from "@/lib/support-access";

interface AdminSchoolPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function AdminSchoolPage({ params }: AdminSchoolPageProps) {
  const { profile } = await requireAdmin();

  const { schoolSlug } = await params;
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
        <SchoolSettings
          school={school}
          actorRole={profile.role}
          actorEmail={profile.email ?? ""}
        />
      </PageHeader>

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
        <ActionCard
          href={`/admin/feedback?school=${encodeURIComponent(school.slug)}`}
          icon={Inbox}
          title="Support inbox"
          description={profile.role === "super_admin"
            ? "Read this school’s submitted support requests without opening private student records."
            : "Review and respond to support requests from this school."}
        />
        <ActionCard href={`/admin/statistics?school=${school.slug}`} icon={BarChart3} title="Statistics" description="Review school participation and active-club trends." />
        {profile.role === "super_admin" && (
          <ActionCard href="/manage/email-outbox" icon={Mail} title="App email status" description="Review queued StormHub notifications. Auth verification email is managed by Supabase." />
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
            actorEmail={profile.email ?? ""}
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
