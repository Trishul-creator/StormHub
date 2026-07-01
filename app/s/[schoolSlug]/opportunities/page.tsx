import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { getOpportunities } from "@/lib/data";
import { getUserBookmarkIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { getSchoolBySlug } from "@/lib/schools";

interface SchoolOpportunitiesPageProps {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SchoolOpportunitiesPage({ params, searchParams }: SchoolOpportunitiesPageProps) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const { userId, isLoggedIn, profile } = await getAuthContext();
  const opportunities = await getOpportunities({ schoolId: school.id, search: query.q });
  const canParticipate = profile?.role === "student" && profile.school_id === school.id;
  const bookmarkedIds = canParticipate ? await getUserBookmarkIds(userId) : new Set<string>();
  const canManage = profile?.role === "super_admin" || (profile?.role === "admin" && profile.school_id === school.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={`${school.short_name || school.name} Opportunities`}
        description="Signups, applications, tryouts, auditions, competitions, interest forms, and deadlines for this school."
      >
        {canManage && (
          <Button asChild>
            <Link href="/manage/opportunities">Create opportunity</Link>
          </Button>
        )}
      </PageHeader>
      <div className="mb-6">
        <SearchBar placeholder="Search opportunities..." defaultValue={query.q} />
      </div>
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
              canParticipate={canParticipate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
