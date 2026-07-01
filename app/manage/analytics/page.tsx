import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-cards";
import { getAdminAnalytics } from "@/lib/data";
import { requireAnalyticsAccess } from "@/lib/auth";
import { Users, Calendar, Briefcase, Bookmark } from "lucide-react";
import { getCurrentSchool } from "@/lib/schools";

export default async function AnalyticsPage() {
  const { profile } = await requireAnalyticsAccess();
  const [analytics, school] = await Promise.all([
    getAdminAnalytics(),
    getCurrentSchool(profile),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Analytics" description={`Platform metrics for ${school?.name ?? "your school"}.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Total clubs" value={analytics.totalClubs} icon={Users} />
        <StatCard label="Active clubs" value={analytics.activeClubs} icon={Users} />
        <StatCard label="Upcoming events" value={analytics.upcomingEvents} icon={Calendar} />
        <StatCard label="Opportunities" value={analytics.totalOpportunities} icon={Briefcase} />
        <StatCard label="Memberships" value={analytics.totalMemberships} icon={Users} />
        <StatCard label="RSVPs" value={analytics.totalRsvps} icon={Calendar} />
        <StatCard label="Bookmarks" value={analytics.totalBookmarks} icon={Bookmark} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-storm-navy mb-4">Most joined clubs</h3>
          <div className="space-y-2">
            {analytics.mostJoinedClubs.map((club, i) => (
              <div key={club.slug} className="flex items-center justify-between text-sm">
                <span>{i + 1}. {club.name}</span>
                <span className="font-medium">{club.count} members</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-storm-navy mb-4">Recent activity</h3>
          <div className="space-y-2">
            {analytics.recentActivity.map((a, i) => (
              <div key={i} className="text-sm flex justify-between">
                <span className="text-muted-foreground">{a.description}</span>
                <span className="text-xs text-muted-foreground capitalize">{a.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
