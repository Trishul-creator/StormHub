import { ClubCard } from "@/components/clubs/club-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { getClubs, getManageableClubs } from "@/lib/data";
import { checkMembership } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { CLUB_FILTER_GROUPS } from "@/lib/utils";
import { getCurrentSchool } from "@/lib/schools";
import { buildEmptyStateActions } from "@/lib/product";
import { isAdminRole } from "@/lib/permissions";

interface ClubsPageProps {
  searchParams: Promise<{ q?: string; category?: string; featured?: string; filter?: string }>;
}

export default async function ClubsPage({ searchParams }: ClubsPageProps) {
  const params = await searchParams;
  const school = await getCurrentSchool();
  const featuredOnly = params.featured === "true" || params.filter === "featured";
  const clubs = await getClubs({
    search: params.q,
    category: params.category,
    featured: featuredOnly,
    filterGroup: params.filter === "featured" ? undefined : params.filter,
  });

  const filterOptions = CLUB_FILTER_GROUPS.map((g) => ({ label: g.label, value: g.label }));
  const featuredHref = `?${new URLSearchParams({
    ...(params.q ? { q: params.q } : {}),
    featured: "true",
  }).toString()}`;

  const { userId, isLoggedIn, profile } = await getAuthContext();
  const manageableClubs = profile ? await getManageableClubs(profile) : [];
  const manageableSlugs = new Set(manageableClubs.map((club) => club.slug));
  const emptyActions = buildEmptyStateActions({
    surface: "clubs",
    query: params.q,
    category: params.category,
    filter: params.filter ?? params.featured,
    isAdmin: isAdminRole(profile?.role),
  });
  const membershipChecks = await Promise.all(
    clubs.map(async (club) => ({
      slug: club.slug,
      isMember: userId ? await checkMembership(club.slug) : false,
    }))
  );
  const membershipMap = Object.fromEntries(membershipChecks.map((m) => [m.slug, m.isMember]));

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Club Directory"
        description={`Discover clubs and activities at ${school?.name ?? "your school"}. Join to access member resources, announcements, and events.`}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <SearchBar placeholder="Search clubs..." defaultValue={params.q} className="flex-1" />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar title="Categories" options={filterOptions} activeValue={params.filter} />
          <div className="mt-6">
            <a
              href={featuredHref}
              className={`block rounded-lg px-3 py-2 text-sm ${featuredOnly ? "bg-storm-electric/10 text-storm-electric font-medium" : "hover:bg-storm-light/50 text-muted-foreground"}`}
            >
              ⭐ Featured clubs
            </a>
          </div>
        </aside>

        <div className="flex-1">
          <MobileFilterDrawer title="Filter clubs" options={filterOptions} activeValue={params.filter} />
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
                  isMember={membershipMap[club.slug]}
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
