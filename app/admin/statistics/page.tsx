import { notFound } from "next/navigation";
import { BarChart3, Building2, Globe2, ShieldCheck } from "lucide-react";
import { StatisticsDashboard } from "@/components/admin/statistics-dashboard";
import { StatisticsScopeSelector } from "@/components/admin/statistics-scope-selector";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { getScopedAdminStatistics } from "@/lib/data";
import { getAllDistricts, getDistrictForProfile, getDistrictSchools } from "@/lib/districts";
import { getAllSchools, getSchoolForProfile } from "@/lib/schools";

interface AdminStatisticsPageProps {
  searchParams: Promise<{ school?: string; district?: string }>;
}

export default async function AdminStatisticsPage({ searchParams }: AdminStatisticsPageProps) {
  const { profile } = await requireAdmin();
  const { school, district } = await searchParams;
  const requestedSchoolSlug = school?.trim() || undefined;
  const requestedDistrictSlug = district?.trim() || undefined;
  const isSuperAdmin = profile.role === "super_admin";
  const isDistrictAdmin = profile.role === "district_admin";
  const allDistricts = isSuperAdmin ? await getAllDistricts() : [];
  const selectedDistrict = isSuperAdmin
    ? requestedDistrictSlug
      ? allDistricts.find((item) => item.slug === requestedDistrictSlug) ?? null
      : null
    : isDistrictAdmin
      ? await getDistrictForProfile(profile)
      : null;
  if (isSuperAdmin && requestedDistrictSlug && !selectedDistrict) notFound();
  if (isDistrictAdmin && !selectedDistrict) notFound();

  const schools = selectedDistrict
    ? await getDistrictSchools(selectedDistrict.id)
    : isSuperAdmin
      ? await getAllSchools()
      : [];
  const selectedSchool = isSuperAdmin || isDistrictAdmin
    ? requestedSchoolSlug
      ? schools.find((item) => item.slug === requestedSchoolSlug) ?? null
      : null
    : await getSchoolForProfile(profile);

  if ((isSuperAdmin || isDistrictAdmin) && requestedSchoolSlug && !selectedSchool) notFound();

  const expectedScopeSchoolId = selectedSchool?.id ?? null;
  const expectedScopeDistrictId = selectedDistrict?.id
    ?? (profile.role === "admin" ? profile.district_id ?? null : null);
  const statistics = await getScopedAdminStatistics(
    profile,
    expectedScopeSchoolId,
    expectedScopeDistrictId,
  );
  const statisticsScopeMatches = statistics?.scopeSchoolId === expectedScopeSchoolId
    && (statistics?.scopeDistrictId ?? null) === expectedScopeDistrictId;
  if (statistics && !statisticsScopeMatches) {
    console.error(
      `[AdminStatisticsPage] Refusing mismatched statistics scope. Expected district ${expectedScopeDistrictId ?? "platform"} / school ${expectedScopeSchoolId ?? "all"}, received district ${statistics.scopeDistrictId ?? "platform"} / school ${statistics.scopeSchoolId ?? "all"}.`
    );
  }
  const scopedStatistics = statisticsScopeMatches ? statistics : null;
  const scopeName = selectedSchool?.name
    ?? selectedDistrict?.name
    ?? (isSuperAdmin ? "All schools" : "Your school");

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
                  : selectedDistrict
                    ? "This view combines only the schools in the selected district."
                    : "Platform totals combine every school workspace."
                : isDistrictAdmin
                  ? selectedSchool
                    ? "This view is intentionally filtered to one school in your district."
                    : "District administrators can only see aggregated data from their assigned district."
                  : "School admins can only see aggregated data from their assigned school."}
            </p>
          </div>
        </div>

        {(isSuperAdmin || isDistrictAdmin) && schools.length > 0 && (
          <StatisticsScopeSelector
            schools={schools.map(({ id, name, slug }) => ({ id, name, slug }))}
            activeSlug={selectedSchool?.slug ?? null}
            baseQuery={selectedDistrict && isSuperAdmin ? { district: selectedDistrict.slug } : undefined}
            allLabel={selectedDistrict ? `All ${selectedDistrict.name} schools` : "All schools"}
          />
        )}
      </div>

      {scopedStatistics ? (
        <div
          data-statistics-scope={scopedStatistics.scopeSchoolId ?? "platform"}
          data-statistics-fingerprint={[
            scopedStatistics.totalPeople,
            scopedStatistics.totalClubs,
            scopedStatistics.activeMemberships,
            scopedStatistics.upcomingEvents,
            scopedStatistics.engagementEvents30d,
          ].join(":")}
        >
          <StatisticsDashboard
            key={`${scopedStatistics.scopeDistrictId ?? "platform"}:${scopedStatistics.scopeSchoolId ?? "all"}`}
            statistics={scopedStatistics}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-storm-navy">
            {statistics ? "Statistics scope could not be verified" : "Statistics are not available yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {statistics
              ? "Reload this page and try the school again. No unverified or out-of-scope statistics were displayed."
              : "Apply the latest database migration, then reload this page. No data was exposed outside your administrative scope."}
          </p>
        </div>
      )}
    </div>
  );
}
