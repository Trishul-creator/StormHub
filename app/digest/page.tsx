import { redirect } from "next/navigation";
import { DigestPreview } from "@/components/manage/digest-preview";
import { PageHeader } from "@/components/layout/page-header";
import { SchoolFilter } from "@/components/layout/school-filter";
import { requireAuth } from "@/lib/auth";
import { getClubs, getEvents, getOpportunities, getRecentAnnouncements } from "@/lib/data";
import { getSchoolFilterContext } from "@/lib/schools";

interface WeeklyDigestPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function WeeklyDigestPage({ searchParams }: WeeklyDigestPageProps) {
  const { profile } = await requireAuth("/digest");
  const params = await searchParams;
  const { schools, selectedSchool } = await getSchoolFilterContext(profile, params.school);
  if (!selectedSchool) redirect(profile.role === "super_admin" ? "/admin/schools" : "/settings");

  const [opportunities, events, clubs, announcements] = await Promise.all([
    getOpportunities({ schoolId: selectedSchool.id }),
    getEvents({ schoolId: selectedSchool.id }),
    getClubs({ schoolId: selectedSchool.id }),
    getRecentAnnouncements(5, selectedSchool.id),
  ]);
  const featuredClubs = clubs.filter((club) => club.is_featured);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Weekly digest"
        description={`A current summary of clubs, opportunities, announcements, and upcoming events at ${selectedSchool.name}.`}
      >
        <SchoolFilter schools={schools} activeSlug={selectedSchool.slug} />
      </PageHeader>
      <DigestPreview
        opportunities={opportunities.filter((item) => item.status === "approved" && item.visibility === "public")}
        events={events}
        clubs={(featuredClubs.length > 0 ? featuredClubs : clubs).slice(0, 5)}
        announcements={announcements}
        schoolName={selectedSchool.name}
      />
    </div>
  );
}
