import { notFound } from "next/navigation";
import { ClubCard } from "@/components/clubs/club-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { EmptyState } from "@/components/layout/empty-state";
import { getClubs } from "@/lib/data";
import { checkMembership } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlug } from "@/lib/schools";
import { canJoinClub, canManageClub } from "@/lib/permissions";

interface SchoolClubsPageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SchoolClubsPage({ params, searchParams }: SchoolClubsPageProps) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const auth = await getAuthContext();
  const clubs = await getClubs({ schoolId: school.id, search: query.q });
  const membershipChecks = await Promise.all(
    clubs.map(async (club) => ({
      slug: club.slug,
      isMember: auth.userId ? await checkMembership(club.slug, school.id) : false,
    }))
  );
  const membershipMap = Object.fromEntries(membershipChecks.map((item) => [item.slug, item.isMember]));

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={`${school.short_name || school.name} Clubs`}
        description="Discover clubs in this school workspace."
      />
      <div className="mb-6">
        <SearchBar placeholder="Search clubs..." defaultValue={query.q} />
      </div>
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
  );
}
