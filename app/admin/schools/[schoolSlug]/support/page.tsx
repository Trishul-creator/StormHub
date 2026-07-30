import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  DatabaseZap,
  Eye,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getManageableClubs } from "@/lib/data";
import { getSchoolBySlug } from "@/lib/schools";
import {
  getActivePlatformSupportSession,
  getPlatformSupportAvailability,
  recordPlatformSupportAccess,
} from "@/lib/support-access";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";

interface SupportWorkspacePageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function SupportWorkspacePage({ params }: SupportWorkspacePageProps) {
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") redirect("/admin?error=super_admin_required");

  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [availability, session] = await Promise.all([
    getPlatformSupportAvailability(),
    getActivePlatformSupportSession(profile, school.id),
  ]);

  const schoolAdminHref = `/admin/schools/${school.slug}#support-access`;

  if (!availability.available) {
    return (
      <SupportPageShell schoolName={school.name} schoolAdminHref={schoolAdminHref}>
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Support database update required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Read-only support is safely disabled because this environment does not have the
              privacy and support tables yet. No private roster, attendance, or coursework data
              has been loaded.
            </p>
            <Button asChild>
              <Link href={schoolAdminHref}>Return to school administration</Link>
            </Button>
          </CardContent>
        </Card>
      </SupportPageShell>
    );
  }

  if (!session) {
    return (
      <SupportPageShell schoolName={school.name} schoolAdminHref={schoolAdminHref}>
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Start a support session first
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Private school information stays locked until you enter a reason and start a
              temporary session for this exact school.
            </p>
            <Button asChild>
              <Link href={schoolAdminHref}>Start support for {school.name}</Link>
            </Button>
          </CardContent>
        </Card>
      </SupportPageShell>
    );
  }

  const supportAccessRecorded = await recordPlatformSupportAccess({
    actor: profile,
    schoolId: school.id,
    action: "view",
    resourceType: "school_support_workspace",
    resourceId: school.id,
  });
  if (!supportAccessRecorded) {
    return (
      <SupportPageShell schoolName={school.name} schoolAdminHref={schoolAdminHref}>
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Private support data stayed locked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The required access-log entry could not be recorded. No private club,
              roster, attendance, coursework, or opportunity data was loaded.
            </p>
            <Button asChild>
              <Link href={schoolAdminHref}>Return to school administration</Link>
            </Button>
          </CardContent>
        </Card>
      </SupportPageShell>
    );
  }

  const clubs = await getManageableClubs(profile, school.id);

  return (
    <SupportPageShell schoolName={school.name} schoolAdminHref={schoolAdminHref}>
      <PlatformSupportExpiryGuard
        expiresAt={session.expires_at}
        returnTo={`/admin/schools/${school.slug}/support`}
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Temporary read-only support is active</p>
          <p className="mt-1">{session.reason}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs">
            <Clock3 className="h-3.5 w-3.5" />
            Ends automatically {new Date(session.expires_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {clubs.map((club) => (
          <Card key={club.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-lg">{club.name}</CardTitle>
                <StatusBadge status={club.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {club.category || "Uncategorized"} · {club.is_active ? "Active" : "Inactive"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/members`}>
                    <Users className="h-4 w-4" /> Members
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/coursework`}>
                    <BookOpenCheck className="h-4 w-4" /> Coursework
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/manage/clubs/${club.slug}/events`}>
                    <CalendarDays className="h-4 w-4" /> Events
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {clubs.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium text-foreground">No clubs in this school</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no club workspaces to inspect.
          </p>
        </div>
      )}
    </SupportPageShell>
  );
}

function SupportPageShell({
  schoolName,
  schoolAdminHref,
  children,
}: {
  schoolName: string;
  schoolAdminHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-5">
        <Link href={schoolAdminHref}>
          <ArrowLeft className="h-4 w-4" /> Back to school administration
        </Link>
      </Button>
      <PageHeader
        title={`Read-only support — ${schoolName}`}
        description="Inspect only the school information needed for a reported issue. Private views are time-limited and recorded."
      />
      {children}
    </div>
  );
}
