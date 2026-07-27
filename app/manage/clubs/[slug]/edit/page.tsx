import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getSchoolTeachers } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { ClubSettingsForm } from "@/components/manage/club-settings-form";
import { canManageClubPublication } from "@/lib/permissions";
import { canArchiveClub } from "@/lib/permissions";
import { ArchiveClubWorkspace } from "@/components/manage/archive-club-workspace";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ publish?: string }>;
}

export default async function EditClubPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const auth = await requireClubManager(club);
  const canManagePublication = canManageClubPublication(auth.profile, club);
  const canArchive = canArchiveClub(auth.profile, club, auth.membership);
  const publishMode = canManagePublication && query.publish === "1" && club.status === "draft";
  const teachers = await getSchoolTeachers(club.school_id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader
        title={publishMode ? "Publish Draft Club" : "Edit Club Profile"}
        description={publishMode ? "Confirm the starting details students will see before this club goes live." : club.name}
      />
      <ClubSettingsForm
        club={club}
        publishMode={publishMode}
        canManagePublication={canManagePublication}
        teachers={teachers}
      />
      {canArchive && club.status !== "archived" && (
        <ArchiveClubWorkspace clubId={club.id} clubName={club.name} />
      )}
    </div>
  );
}
