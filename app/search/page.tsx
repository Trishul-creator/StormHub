import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { getAdminUsers, getClubs, getEvents, getOpportunities } from "@/lib/data";
import { getAuthContext } from "@/lib/auth";
import { isAdminRole } from "@/lib/permissions";
import { buildEmptyStateActions, buildGlobalSearchResults } from "@/lib/product";
import { humanizeLabel } from "@/lib/utils";
import { PublicDemoNotice } from "@/components/layout/public-demo-notice";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const { profile, isLoggedIn } = await getAuthContext();
  const canSearchPeople = isAdminRole(profile?.role);

  const [clubs, events, opportunities, people] = query.length >= 2
    ? await Promise.all([
        getClubs({ search: query }),
        getEvents(),
        getOpportunities({ search: query }),
        canSearchPeople ? getAdminUsers() : Promise.resolve([]),
      ])
    : [[], [], [], []];

  const results = buildGlobalSearchResults({ query, clubs, events, opportunities, people });
  const emptyActions = buildEmptyStateActions({ surface: "search", query });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {!isLoggedIn && <div className="mb-6"><PublicDemoNotice /></div>}
      <PageHeader
        title="Search StormHub"
        description="Find clubs, calendar events, opportunities, and admin-visible user records from one place."
      />

      <SearchBar placeholder="Search clubs, events, opportunities..." defaultValue={query} />

      <div className="mt-6">
        {query.length < 2 ? (
          <EmptyState
            title="Search across the school"
            description="Type at least two characters to search clubs, events, opportunities, and the records your role can access."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No results found"
            description="Try another club name, deadline, event type, category, or student/staff name if you have admin access."
            actions={emptyActions}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {results.length} best matches for &quot;{query}&quot;
            </p>
            {results.map((result) => (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.href}
                className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4 transition hover:border-storm-electric/40 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{humanizeLabel(result.type)}</Badge>
                    {result.context && <span className="text-xs text-muted-foreground">{result.context}</span>}
                  </div>
                  <h2 className="mt-2 font-semibold text-storm-navy">{result.title}</h2>
                  {result.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.description}</p>}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
