import { DigestPreview } from "@/components/manage/digest-preview";
import { PageHeader } from "@/components/layout/page-header";
import { getOpportunities, getEvents, getFeaturedClubs, getRecentAnnouncements } from "@/lib/data";
import { requireManager } from "@/lib/auth";
import { getCurrentSchool } from "@/lib/schools";

export default async function DigestPage() {
  const { profile } = await requireManager();

  const [opportunities, events, clubs, announcements, school] = await Promise.all([
    getOpportunities(),
    getEvents(),
    getFeaturedClubs(),
    getRecentAnnouncements(),
    getCurrentSchool(profile),
  ]);
  const chronologicalAnnouncements = [...announcements].sort((a, b) => {
    const aTime = new Date(a.published_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.published_at ?? b.created_at ?? 0).getTime();
    return aTime - bTime;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader
        title="Weekly Digest"
        description="Preview newsletter content for school announcements. Copy and paste into your school newsletter."
      />
      <DigestPreview
        opportunities={opportunities}
        events={events}
        clubs={clubs}
        announcements={chronologicalAnnouncements}
        schoolName={school?.name ?? "Your school"}
      />
    </div>
  );
}
