import { notFound } from "next/navigation";
import { ClubManagementNavigation } from "@/components/manage/club-management-navigation";
import { requireClubManager } from "@/lib/auth";
import { getManagedClubBySlug } from "@/lib/data";
import { canManageClubCoursework, canManageClubRoster } from "@/lib/permissions";

interface ClubManageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ClubManageLayout({ children, params }: ClubManageLayoutProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);

  return (
    <>
      <ClubManagementNavigation
        clubName={club.name}
        slug={slug}
        canManageCoursework={canManageClubCoursework(profile, club, membership)}
        canManageRoster={canManageClubRoster(profile, club, membership)}
      />
      {children}
    </>
  );
}
