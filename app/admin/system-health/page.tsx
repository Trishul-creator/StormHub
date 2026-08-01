import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  KeyRound,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import {
  getSystemHealthSnapshot,
  type SystemHealthSnapshot,
} from "@/lib/system-health";

export const dynamic = "force-dynamic";

type HealthItem = {
  name: string;
  detail: string;
  healthy: boolean;
  status: string;
  remediation: string;
  icon: typeof Activity;
};

function getHealthItems(snapshot: SystemHealthSnapshot): HealthItem[] {
  const retentionReady = snapshot.dataRetention.status === "fresh"
    || snapshot.dataRetention.status === "running";

  return [
    {
      name: "Database",
      detail: "The production service account can read the required application schema.",
      healthy: snapshot.database === "ok",
      status: snapshot.database === "ok" ? "Available" : "Unavailable",
      remediation: "Verify the production Supabase URL and service-role key, then apply every pending migration with supabase db push.",
      icon: Database,
    },
    {
      name: "Private coursework storage",
      detail: "Student uploads use the non-public coursework-private bucket.",
      healthy: snapshot.storage === "ok",
      status: snapshot.storage === "ok" ? "Private and available" : "Unavailable",
      remediation: "Apply the coursework storage migration and confirm that coursework-private exists with Public disabled.",
      icon: HardDrive,
    },
    {
      name: "Email confirmation",
      detail: "New accounts must verify their email address before signing in.",
      healthy: snapshot.emailConfirmation === "required",
      status: snapshot.emailConfirmation === "required"
        ? "Required"
        : snapshot.emailConfirmation === "disabled"
          ? "Disabled"
          : "Could not verify",
      remediation: "In Supabase Authentication settings, keep email sign-ups enabled and turn off automatic email confirmation.",
      icon: MailCheck,
    },
    {
      name: "Application email delivery",
      detail: "Operational messages are configured to leave the application through Resend.",
      healthy: snapshot.emailDeliveryReady,
      status: snapshot.emailDeliveryReady
        ? "Configured"
        : `${snapshot.emailDelivery.mode.replaceAll("_", " ")} mode`,
      remediation: "Set EMAIL_DELIVERY_MODE=send plus RESEND_API_KEY and EMAIL_FROM in the production deployment, then redeploy.",
      icon: Send,
    },
    {
      name: "Scheduled-job authentication",
      detail: "Automated publishing, digests, and retention jobs require a server-only secret.",
      healthy: snapshot.cronAuthentication === "configured",
      status: snapshot.cronAuthentication === "configured" ? "Configured" : "Missing",
      remediation: "Add a server-only CRON_SECRET to the production deployment and redeploy. Never use a NEXT_PUBLIC_ name.",
      icon: KeyRound,
    },
    {
      name: "Data retention",
      detail: snapshot.dataRetention.lastCompletedAt
        ? `Last recorded run finished ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.dataRetention.lastCompletedAt))}.`
        : "No recent completed retention run was found.",
      healthy: retentionReady,
      status: snapshot.dataRetention.status === "fresh"
        ? "Current"
        : snapshot.dataRetention.status === "running"
          ? "Running"
          : snapshot.dataRetention.status.charAt(0).toUpperCase() + snapshot.dataRetention.status.slice(1),
      remediation: "Verify CRON_SECRET, invoke /api/cron/data-retention once with its bearer token, and confirm the daily Vercel cron remains enabled.",
      icon: Clock3,
    },
  ];
}

export default async function SystemHealthPage() {
  const { profile } = await requireAdmin();
  if (profile.role !== "super_admin") {
    redirect("/admin?error=platform_admin_required");
  }

  const snapshot = await getSystemHealthSnapshot({ forceRefresh: true });
  const items = getHealthItems(snapshot);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="System health"
        description="Production readiness checks for platform infrastructure and automated safeguards."
      >
        <Button asChild variant="outline">
          <Link href="/admin/system-health" prefetch={false}>
            <RefreshCw className="h-4 w-4" /> Run checks again
          </Link>
        </Button>
      </PageHeader>

      <section
        className={snapshot.healthy
          ? "mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/35"
          : "mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/35"}
        aria-labelledby="health-summary-title"
      >
        <div className="flex items-start gap-3">
          {snapshot.healthy
            ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            : <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="health-summary-title" className="text-lg font-semibold text-storm-navy">
                {snapshot.healthy ? "All production checks passed" : "Production needs attention"}
              </h2>
              <Badge variant={snapshot.healthy ? "success" : "warning"}>
                {snapshot.healthy ? "Healthy" : `${items.filter((item) => !item.healthy).length} checks failing`}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The website can still load while a background safeguard is degraded. This page checks those systems separately.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Checked {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(snapshot.checkedAt))}
              {` in ${snapshot.probeDurationMs} ms`}.
            </p>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-storm-navy">Production checks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuration values are never displayed here; only readiness results are shown.
          </p>
        </div>
        <div className="divide-y">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={item.healthy
                    ? "rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                    : "rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-storm-navy">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    {!item.healthy && (
                      <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
                        <strong>Fix:</strong> {item.remediation}
                      </p>
                    )}
                  </div>
                </div>
                <Badge className="w-fit" variant={item.healthy ? "success" : "warning"}>
                  {item.healthy
                    ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                  {item.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
