import { DigestPreview } from "@/components/manage/digest-preview";
import { PageHeader } from "@/components/layout/page-header";
import { getOpportunities, getEvents, getFeaturedClubs, getRecentAnnouncements } from "@/lib/data";
import { requireManager } from "@/lib/auth";
import { getCurrentSchool } from "@/lib/schools";

export default async function DigestPage() {
  const { profile } = await requireManager();
  const school = await getCurrentSchool(profile);

  const [opportunities, events, clubs, announcements] = await Promise.all([
    getOpportunities({ schoolId: school?.id }),
    getEvents({ schoolId: school?.id }),
    getFeaturedClubs(school?.id),
    getRecentAnnouncements(5, school?.id),
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
        opportunities={opportunities.filter((item) => item.status === "approved" && item.visibility === "public")}
        events={events}
        clubs={clubs}
        announcements={chronologicalAnnouncements}
        schoolName={school?.name ?? "Your school"}
      />
    </div>
  );
}
