import { ClubCard } from "@/components/clubs/club-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { getClubs, getManageableClubs, getUserClubMembershipIds } from "@/lib/data";
import { getAuthContext } from "@/lib/auth";
import { CLUB_FILTER_GROUPS } from "@/lib/utils";
import { getCurrentSchool } from "@/lib/schools";
import { buildEmptyStateActions } from "@/lib/product";
import { isAdminRole } from "@/lib/permissions";
import { SchoolFilter } from "@/components/layout/school-filter";
import { getSchoolFilterContext } from "@/lib/schools";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";
import Link from "next/link";

interface ClubsPageProps {
  searchParams: Promise<{ q?: string; category?: string; featured?: string; filter?: string; school?: string }>;
}

export default async function ClubsPage({ searchParams }: ClubsPageProps) {
  const params = await searchParams;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  const { schools, selectedSchool } = await getSchoolFilterContext(profile, params.school);
  const school = selectedSchool ?? await getCurrentSchool(profile);
  const featuredOnly = params.featured === "true" || params.filter === "featured";
  const [clubs, membershipIds] = await Promise.all([
    getClubs({
      search: params.q,
      category: params.category,
      featured: featuredOnly,
      filterGroup: params.filter === "featured" ? undefined : params.filter,
      schoolId: school?.id,
      viewer: profile,
    }),
    getUserClubMembershipIds(userId),
  ]);

  const filterOptions = CLUB_FILTER_GROUPS.map((g) => ({ label: g.label, value: g.label }));
  const featuredParams = new URLSearchParams({
    ...(params.q ? { q: params.q } : {}),
    ...(school?.slug ? { school: school.slug } : {}),
    ...(!featuredOnly ? { featured: "true" } : {}),
  });
  const featuredHref = featuredParams.size ? `?${featuredParams.toString()}` : "?";

  const manageableClubs = profile ? await getManageableClubs(profile) : [];
  const manageableSlugs = new Set(manageableClubs.map((club) => club.slug));
  const emptyActions = buildEmptyStateActions({
    surface: "clubs",
    query: params.q,
    category: params.category,
    filter: params.filter ?? params.featured,
    isAdmin: isAdminRole(profile?.role),
  });
  return (
    <div className="container mx-auto px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title="Club Directory"
        description={`Discover clubs and activities at ${school?.name ?? "your school"}. Join to access member resources, announcements, and events.`}
      />

      <div data-tour="club-directory-tools" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchBar placeholder="Search clubs..." defaultValue={params.q} className="flex-1" />
        <SchoolFilter schools={schools} activeSlug={school?.slug} />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar
            title="Categories"
            options={filterOptions}
            activeValue={params.filter === "featured" ? undefined : params.filter}
            exclusiveParamNames={["featured", "category"]}
          />
          <div className="mt-6">
            <Link
              href={featuredHref}
              scroll={false}
              className={`block rounded-lg px-3 py-2 text-sm ${featuredOnly ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"}`}
            >
              ⭐ Featured clubs
            </Link>
          </div>
        </aside>

        <div data-tour="club-directory-results" className="flex-1">
          <MobileFilterDrawer
            title="Filter clubs"
            options={filterOptions}
            activeValue={params.filter === "featured" ? undefined : params.filter}
            exclusiveParamNames={["featured", "category"]}
          />
          <p className="mb-4 text-sm text-muted-foreground">{clubs.length} clubs found</p>
          {clubs.length === 0 ? (
            <EmptyState
              title="No clubs found"
              description="Try a broader search, clear the filters, or jump into the full school search if this may be an event or opportunity."
              actions={emptyActions}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isMember={membershipIds.has(club.id)}
                  isLoggedIn={isLoggedIn}
                  canJoin={profile?.role === "student"}
                  canManage={manageableSlugs.has(club.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
