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

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader
        title="Weekly Digest"
        description="Preview newsletter content for school announcements. Copy and paste into your school newsletter."
      />
      <DigestPreview opportunities={opportunities} events={events} clubs={clubs} workshops={workshops} announcements={announcements} />
      <p className="mt-4 text-sm text-muted-foreground">
        {/* TODO: Configure email provider (Resend, SendGrid) for automated digest sending */}
        Email sending requires an email provider. Configure RESEND_API_KEY or similar in production.
      </p>
    </div>
  );
}
