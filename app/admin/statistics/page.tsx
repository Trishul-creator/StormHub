import { notFound } from "next/navigation";
import { BarChart3, Building2, Globe2, ShieldCheck } from "lucide-react";
import { StatisticsDashboard } from "@/components/admin/statistics-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getScopedAdminStatistics } from "@/lib/data";
import { getAllSchools, getSchoolForProfile } from "@/lib/schools";

interface AdminStatisticsPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function AdminStatisticsPage({ searchParams }: AdminStatisticsPageProps) {
  const { profile } = await requireAdmin();
  const { school: requestedSchoolSlug } = await searchParams;
  const isSuperAdmin = profile.role === "super_admin";
  const schools = isSuperAdmin ? await getAllSchools() : [];
  const selectedSchool = isSuperAdmin
    ? requestedSchoolSlug
      ? schools.find((school) => school.slug === requestedSchoolSlug) ?? null
      : null
    : await getSchoolForProfile(profile);

  if (isSuperAdmin && requestedSchoolSlug && !selectedSchool) notFound();

  const statistics = await getScopedAdminStatistics(profile, selectedSchool?.id ?? null);
  const scopeName = selectedSchool?.name ?? (isSuperAdmin ? "All schools" : "Your school");

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Statistics"
        description={`Participation and activity signals for ${scopeName}.`}
      />

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-900/70 dark:from-blue-950/50 dark:to-indigo-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-card p-2.5 text-blue-700 shadow-sm dark:text-blue-300">
            {selectedSchool ? <Building2 className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-storm-navy">{scopeName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-xs font-medium text-blue-800 dark:text-blue-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Scope enforced
              </span>
            </div>
            <p className="mt-1 text-sm text-blue-950/70 dark:text-blue-200/75">
              {isSuperAdmin
                ? selectedSchool
                  ? "This view is intentionally filtered to one school."
                  : "Platform totals combine every school workspace."
                : "School admins can only see aggregated data from their assigned school."}
            </p>
          </div>
        </div>

        {isSuperAdmin && schools.length > 0 && (
          <form method="get" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-950/70">
              View scope
              <select
                name="school"
                defaultValue={selectedSchool?.slug ?? ""}
                className="mt-1 block h-10 w-full min-w-56 rounded-lg border border-blue-200 bg-card px-3 text-sm font-medium normal-case tracking-normal text-storm-navy shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-blue-900"
              >
                <option value="">All schools</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.slug}>{school.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" className="h-10">Apply</Button>
          </form>
        )}
      </div>

      {statistics ? (
        <StatisticsDashboard statistics={statistics} />
      ) : (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-storm-navy">Statistics are not available yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Apply the latest database migration, then reload this page. No data was exposed outside your administrative scope.
          </p>
        </div>
      )}
    </div>
  );
}
