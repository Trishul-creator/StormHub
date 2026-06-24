import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getClubBySlug } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { ClubSettingsForm } from "@/components/manage/club-settings-form";

interface PageProps { params: Promise<{ slug: string }> }

export default async function EditClubPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  await requireClubManager(club);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader title="Edit Club Profile" description={club.name} />
      <ClubSettingsForm club={club} />
    </div>
  );
}
