import { DigestPreview } from "@/components/manage/digest-preview";
import { PageHeader } from "@/components/layout/page-header";
import { getOpportunities, getEvents, getFeaturedClubs, getWorkshops, getRecentAnnouncements } from "@/lib/data";
import { requireManager } from "@/lib/auth";

export default async function DigestPage() {
  await requireManager();

  const [opportunities, events, clubs, workshops, announcements] = await Promise.all([
    getOpportunities(),
    getEvents(),
    getFeaturedClubs(),
    getWorkshops(),
    getRecentAnnouncements(),
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
      <DigestPreview opportunities={opportunities} events={events} clubs={clubs} workshops={workshops} announcements={chronologicalAnnouncements} />
    </div>
  );
}
