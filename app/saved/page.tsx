import { redirect } from "next/navigation";
import Link from "next/link";
import { getStudentDashboard } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Bookmark } from "lucide-react";

export default async function SavedPage() {
  const { userId, profile } = await requireAuth("/saved");
  if (profile.role !== "student") redirect("/dashboard");

  const dashboard = await getStudentDashboard(userId);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Saved Opportunities"
        description="Opportunities you've bookmarked for later."
      />
      {dashboard.savedOpportunities.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Bookmark opportunities to find them here later."
          actionLabel="Browse opportunities"
          actionHref="/opportunities"
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.savedOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} isLoggedIn isBookmarked />
          ))}
        </div>
      )}
    </div>
  );
}
