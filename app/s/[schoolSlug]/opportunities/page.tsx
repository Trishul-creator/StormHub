import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { getOpportunities, getOpportunityCategories } from "@/lib/data";
import { getUserBookmarkIds, getUserOpportunitySignupIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlugForViewer } from "@/lib/schools";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";
import { canAccessSchoolAdmin } from "@/lib/permissions";

interface SchoolOpportunitiesPageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ q?: string; category?: string; closing?: string; grade?: string }>;
}

export default async function SchoolOpportunitiesPage({ params, searchParams }: SchoolOpportunitiesPageProps) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const school = await getSchoolBySlugForViewer(schoolSlug, profile);
  if (!school) notFound();

  const selectedGrade = query.grade ? Number(query.grade) : undefined;
  const [allOpportunities, categories] = await Promise.all([
    getOpportunities({
      schoolId: school.id,
      search: query.q,
      category: query.category,
      closingSoon: query.closing === "true",
      viewer: profile,
    }),
    getOpportunityCategories(school.id, profile),
  ]);
  const opportunities = Number.isFinite(selectedGrade)
    ? allOpportunities.filter((opportunity) => {
        const min = opportunity.grade_min ?? 9;
        const max = opportunity.grade_max ?? 12;
        return selectedGrade! >= min && selectedGrade! <= max;
      })
    : allOpportunities;
  const canParticipate = !profile || (profile.role === "student" && profile.school_id === school.id);
  const [bookmarkedIds, signedUpIds] = canParticipate
    ? await Promise.all([getUserBookmarkIds(userId), getUserOpportunitySignupIds(userId)])
    : [new Set<string>(), new Set<string>()];
  const canManage = canAccessSchoolAdmin(profile, school.id, school.district_id);
  const managementHref = profile?.role === "admin"
    ? "/manage/opportunities"
    : `/admin/schools/${school.slug}/opportunities`;
  const filterOptions = categories.map((category) => ({ label: category, value: category }));
  const closingParams = new URLSearchParams({
    ...(query.q ? { q: query.q } : {}),
    ...(query.grade ? { grade: query.grade } : {}),
    ...(query.closing !== "true" ? { closing: "true" } : {}),
  });
  const closingHref = closingParams.size ? `?${closingParams.toString()}` : "?";

  return (
    <div className="container mx-auto px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title={`${school.short_name || school.name} Opportunities`}
        description={
          profile?.role === "teacher"
            ? "Browse this school’s opportunities in read-only mode. Teacher accounts cannot save, RSVP, or sign up."
            : "Signups, applications, tryouts, auditions, competitions, interest forms, and deadlines for this school."
        }
      >
        {canManage && (
          <Button asChild>
            <Link href={managementHref}>Manage opportunities</Link>
          </Button>
        )}
      </PageHeader>
      <div data-tour="opportunity-tools" className="mb-6">
        <SearchBar placeholder="Search opportunities..." defaultValue={query.q} />
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar
            title="Category"
            options={filterOptions}
            activeValue={query.category}
            paramName="category"
            exclusiveParamNames={["closing"]}
          />
          <Link
            href={closingHref}
            scroll={false}
            className={`mt-6 block rounded-lg px-3 py-2 text-sm ${
              query.closing === "true"
                ? "bg-amber-100 font-medium text-amber-800"
                : "text-muted-foreground hover:bg-storm-light/50"
            }`}
          >
            ⏰ Closing soon
          </Link>
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-storm-navy">Grade</p>
            {[9, 10, 11, 12].map((grade) => {
              const gradeParams = new URLSearchParams({
                ...(query.q ? { q: query.q } : {}),
                ...(query.category ? { category: query.category } : {}),
                ...(query.closing ? { closing: query.closing } : {}),
                grade: String(grade),
              });
              return (
                <Link
                  key={grade}
                  href={`?${gradeParams.toString()}`}
                  scroll={false}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    query.grade === String(grade)
                      ? "bg-storm-electric/10 font-medium text-storm-electric"
                      : "text-muted-foreground hover:bg-storm-light/50"
                  }`}
                >
                  Grade {grade}
                </Link>
              );
            })}
          </div>
        </aside>
        <div data-tour="opportunity-results" className="min-w-0 flex-1">
          <MobileFilterDrawer
            title="Filter opportunities"
            options={filterOptions}
            activeValue={query.category}
            paramName="category"
            exclusiveParamNames={["closing"]}
          />
          <p className="mb-4 text-sm text-muted-foreground">{opportunities.length} opportunities</p>
          {opportunities.length === 0 ? (
            <EmptyState title="No opportunities found" description="This school has not published matching opportunities yet." actionLabel="Back to school home" actionHref={`/s/${school.slug}`} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  isLoggedIn={isLoggedIn}
                  isBookmarked={bookmarkedIds.has(opportunity.id)}
                  isSignedUp={signedUpIds.has(opportunity.id)}
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
