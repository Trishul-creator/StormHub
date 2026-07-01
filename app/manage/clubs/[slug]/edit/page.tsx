import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getSchoolTeachers } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { ClubSettingsForm } from "@/components/manage/club-settings-form";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ publish?: string }>;
}

export default async function EditClubPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  await requireClubManager(club);
  const publishMode = query.publish === "1" && club.status === "draft";
  const teachers = await getSchoolTeachers(club.school_id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader
        title={publishMode ? "Publish Draft Club" : "Edit Club Profile"}
        description={publishMode ? "Confirm the starting details students will see before this club goes live." : club.name}
      />
      <ClubSettingsForm club={club} publishMode={publishMode} teachers={teachers} />
    </div>
  );
}
