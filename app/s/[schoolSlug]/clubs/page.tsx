import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubCard } from "@/components/clubs/club-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { getClubs } from "@/lib/data";
import { checkMembership } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlugForViewer } from "@/lib/schools";
import {
  canAccessSchoolAdmin,
  canJoinClub,
  canManageClub,
} from "@/lib/permissions";
import { CLUB_FILTER_GROUPS } from "@/lib/utils";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface SchoolClubsPageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ q?: string; filter?: string; featured?: string }>;
}

export default async function SchoolClubsPage({ params, searchParams }: SchoolClubsPageProps) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  const auth = await getAuthContext();
  const school = await getSchoolBySlugForViewer(schoolSlug, auth.profile);
  if (!school) notFound();

  const featuredOnly = query.featured === "true" || query.filter === "featured";
  const clubs = await getClubs({
    schoolId: school.id,
    search: query.q,
    featured: featuredOnly,
    filterGroup: query.filter === "featured" ? undefined : query.filter,
  });
  const filterOptions = CLUB_FILTER_GROUPS.map((group) => ({ label: group.label, value: group.label }));
  const featuredParams = new URLSearchParams({
    ...(query.q ? { q: query.q } : {}),
    ...(!featuredOnly ? { featured: "true" } : {}),
  });
  const featuredHref = featuredParams.size ? `?${featuredParams.toString()}` : "?";
  const membershipChecks = await Promise.all(
    clubs.map(async (club) => ({
      slug: club.slug,
      isMember: auth.userId ? await checkMembership(club.slug, school.id) : false,
    }))
  );
  const membershipMap = Object.fromEntries(membershipChecks.map((item) => [item.slug, item.isMember]));

  return (
    <div className="container mx-auto px-4 py-8">
      {!auth.isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title={`${school.short_name || school.name} Clubs`}
        description="Discover clubs in this school workspace."
      >
        {auth.profile?.role === "teacher" && auth.profile.school_id === school.id && (
          <Button asChild>
            <Link href="/manage/clubs/drafts">Propose a club</Link>
          </Button>
        )}
        {canAccessSchoolAdmin(auth.profile, school.id, school.district_id) && (
          <Button asChild>
            <Link
              href={
                auth.profile?.role === "super_admin" || auth.profile?.role === "district_admin"
                  ? `/admin/schools/${school.slug}/drafts`
                  : "/manage/clubs/drafts"
              }
            >
              Add a club
            </Link>
          </Button>
        )}
      </PageHeader>
      <div data-tour="club-directory-tools" className="mb-6">
        <SearchBar placeholder="Search clubs..." defaultValue={query.q} />
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar
            title="Categories"
            options={filterOptions}
            activeValue={query.filter === "featured" ? undefined : query.filter}
            exclusiveParamNames={["featured"]}
          />
          <Link
            href={featuredHref}
            scroll={false}
            className={`mt-6 block rounded-lg px-3 py-2 text-sm ${
              featuredOnly
                ? "bg-storm-electric/10 font-medium text-storm-electric"
                : "text-muted-foreground hover:bg-storm-light/50"
            }`}
          >
            ⭐ Featured clubs
          </Link>
        </aside>
        <div data-tour="club-directory-results" className="min-w-0 flex-1">
          <MobileFilterDrawer
            title="Filter clubs"
            options={filterOptions}
            activeValue={query.filter === "featured" ? undefined : query.filter}
            exclusiveParamNames={["featured"]}
          />
          <p className="mb-4 text-sm text-muted-foreground">{clubs.length} clubs found</p>
          {clubs.length === 0 ? (
            <EmptyState title="No clubs found" description="This school does not have matching public clubs yet." actionLabel="Back to school home" actionHref={`/s/${school.slug}`} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isMember={membershipMap[club.slug]}
                  isLoggedIn={auth.isLoggedIn}
                  canJoin={canJoinClub(auth.profile, club)}
                  canManage={canManageClub(auth.profile, club)}
                  schoolSlug={school.slug}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
