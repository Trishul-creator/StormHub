import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { getOpportunities, getOpportunityCategories } from "@/lib/data";
import { getUserBookmarkIds, getUserOpportunitySignupIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildEmptyStateActions } from "@/lib/product";
import { canAccessSchoolAdmin, isAdminRole } from "@/lib/permissions";
import { SchoolFilter } from "@/components/layout/school-filter";
import { getSchoolFilterContext } from "@/lib/schools";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface OpportunitiesPageProps {
  searchParams: Promise<{ q?: string; category?: string; closing?: string; grade?: string; school?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const { schools, selectedSchool } = await getSchoolFilterContext(profile, params.school);

  const selectedGrade = params.grade ? Number(params.grade) : undefined;
  const [allOpportunities, categories] = await Promise.all([
    getOpportunities({
      search: params.q,
      category: params.category,
      closingSoon: params.closing === "true",
      schoolId: selectedSchool?.id,
      viewer: profile,
    }),
    getOpportunityCategories(selectedSchool?.id, profile),
  ]);
  const opportunities = Number.isFinite(selectedGrade)
    ? allOpportunities.filter((opportunity) => {
        const min = opportunity.grade_min ?? 9;
        const max = opportunity.grade_max ?? 12;
        return selectedGrade! >= min && selectedGrade! <= max;
      })
    : allOpportunities;
  const canManageSelectedSchool = Boolean(
    selectedSchool
    && canAccessSchoolAdmin(profile, selectedSchool.id, selectedSchool.district_id)
  );
  const managementHref = selectedSchool
    ? profile?.role === "admin"
      ? "/manage/opportunities"
      : `/admin/schools/${selectedSchool.slug}/opportunities`
    : null;

  const canParticipate = profile?.role === "student" || !profile;
  const [bookmarkedIds, signedUpIds] = canParticipate
    ? await Promise.all([getUserBookmarkIds(userId), getUserOpportunitySignupIds(userId)])
    : [new Set<string>(), new Set<string>()];

  const filterOptions = categories.map((category) => ({ label: category, value: category }));
  const closingParams = new URLSearchParams({
    ...(params.q ? { q: params.q } : {}),
    ...(params.grade ? { grade: params.grade } : {}),
    ...(selectedSchool?.slug ? { school: selectedSchool.slug } : {}),
    ...(params.closing !== "true" ? { closing: "true" } : {}),
  });
  const closingHref = closingParams.size ? `?${closingParams.toString()}` : "?";
  const emptyActions = buildEmptyStateActions({
    surface: "opportunities",
    query: params.q,
    category: params.category,
    grade: params.grade,
    closing: params.closing,
    isAdmin: isAdminRole(profile?.role),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title="Opportunities"
        description={
          profile && isAdminRole(profile.role)
            ? "Review all school-wide opportunities. Administrator accounts can create and manage listings but cannot participate."
            : profile?.role === "teacher"
              ? "Browse school-wide opportunities in read-only mode. Teacher accounts cannot save, RSVP, or sign up."
            : "Signups, applications, tryouts, auditions, competitions, interest forms, and deadlines."
        }
      >
        {canManageSelectedSchool && managementHref && (
          <Button asChild>
            <Link href={managementHref}>Manage opportunities</Link>
          </Button>
        )}
      </PageHeader>

      <div data-tour="opportunity-tools" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchBar placeholder="Search opportunities..." defaultValue={params.q} className="flex-1" />
        <SchoolFilter schools={schools} activeSlug={selectedSchool?.slug} />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar
            title="Category"
            options={filterOptions}
            activeValue={params.category}
            paramName="category"
            exclusiveParamNames={["closing"]}
          />
          <div className="mt-6 space-y-1">
            <Link href={closingHref} scroll={false} className={`block rounded-lg px-3 py-2 text-sm ${params.closing === "true" ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-storm-light/50 text-muted-foreground"}`}>
              ⏰ Closing soon
            </Link>
          </div>
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-storm-navy">Grade</p>
            <div className="space-y-1">
              {[9, 10, 11, 12].map((grade) => {
                const href = `?${new URLSearchParams({
                  ...(params.q ? { q: params.q } : {}),
                  ...(params.category ? { category: params.category } : {}),
                  ...(params.closing ? { closing: params.closing } : {}),
                  ...(selectedSchool?.slug ? { school: selectedSchool.slug } : {}),
                  grade: String(grade),
                }).toString()}`;
                return (
                  <Link
                    key={grade}
                    href={href}
                    scroll={false}
                    className={`block rounded-lg px-3 py-2 text-sm ${params.grade === String(grade) ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"}`}
                  >
                    Grade {grade}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <div data-tour="opportunity-results" className="flex-1">
          <MobileFilterDrawer
            title="Filter opportunities"
            options={filterOptions}
            activeValue={params.category}
            paramName="category"
            exclusiveParamNames={["closing"]}
          />
          <p className="mb-4 text-sm text-muted-foreground">{opportunities.length} opportunities</p>
          {opportunities.length === 0 ? (
            <EmptyState
              title="No opportunities found"
              description="Try a broader search, clear the filters, or check the school-wide search if this may be a club or event."
              actions={emptyActions}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  isLoggedIn={isLoggedIn}
                  isBookmarked={bookmarkedIds.has(opp.id)}
                  isSignedUp={signedUpIds.has(opp.id)}
                  canParticipate={canParticipate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
