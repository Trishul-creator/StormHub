import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { FilterSidebar, MobileFilterDrawer } from "@/components/layout/filter-sidebar";
import { EmptyState } from "@/components/layout/empty-state";
import { getOpportunities, getOpportunityCategories } from "@/lib/data";
import { getUserBookmarkIds } from "@/lib/actions";
import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface OpportunitiesPageProps {
  searchParams: Promise<{ q?: string; category?: string; closing?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const { userId, isLoggedIn, profile } = await getAuthContext();
  if (profile?.role === "teacher") redirect("/calendar");

  const [opportunities, categories] = await Promise.all([
    getOpportunities({
    search: params.q,
    category: params.category,
    closingSoon: params.closing === "true",
    }),
    getOpportunityCategories(),
  ]);

  const canParticipate = profile?.role === "student" || !profile;
  const bookmarkedIds = canParticipate ? await getUserBookmarkIds(userId) : new Set<string>();

  const filterOptions = categories.map((category) => ({ label: category, value: category }));

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Opportunities"
        description={
          profile && ["admin", "super_admin"].includes(profile.role)
            ? "Review all school-wide opportunities. Administrator accounts can create and manage listings but cannot participate."
            : "Signups, applications, tryouts, auditions, competitions, interest forms, and deadlines."
        }
      >
        {profile && ["admin", "super_admin"].includes(profile.role) && (
          <Button asChild>
            <Link href="/manage/opportunities">Create opportunity</Link>
          </Button>
        )}
      </PageHeader>

      <div className="mb-6">
        <SearchBar placeholder="Search opportunities..." defaultValue={params.q} />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar title="Category" options={filterOptions} activeValue={params.category} paramName="category" />
          <div className="mt-6 space-y-1">
            <a href="?closing=true" className={`block rounded-lg px-3 py-2 text-sm ${params.closing === "true" ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-storm-light/50 text-muted-foreground"}`}>
              ⏰ Closing soon
            </a>
          </div>
        </aside>

        <div className="flex-1">
          <MobileFilterDrawer title="Filter opportunities" options={filterOptions} activeValue={params.category} paramName="category" />
          <p className="mb-4 text-sm text-muted-foreground">{opportunities.length} opportunities</p>
          {opportunities.length === 0 ? (
            <EmptyState title="No opportunities found" description="Try a different search or category." actionLabel="View all" actionHref="/opportunities" />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  isLoggedIn={isLoggedIn}
                  isBookmarked={bookmarkedIds.has(opp.id)}
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
