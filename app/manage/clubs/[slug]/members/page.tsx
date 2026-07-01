import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubMemberCount, getClubRoster } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { canManageClubRoster } from "@/lib/permissions";
import { RoleBadge } from "@/components/ui/badge";
import { RosterMemberActions } from "@/components/manage/roster-member-actions";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageMembersPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);
  const [count, roster] = await Promise.all([
    getClubMemberCount(club.id),
    getClubRoster(club.id),
  ]);
  const canEditRoster = canManageClubRoster(profile, club, membership);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={`Members — ${club.name}`} description={`${count} active members`} />
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-storm-light/50">
            <tr>
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Club role</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="p-4">{member.profile?.full_name || "Unnamed user"}</td>
                <td className="p-4 text-muted-foreground">{member.profile?.email || "—"}</td>
                <td className="p-4"><RoleBadge role={member.role} /></td>
                <td className="p-4">
                  {member.role === "sponsor" ? (
                    <span className="text-xs text-muted-foreground">Managed in Users & Roles</span>
                  ) : canEditRoster ? (
                    <RosterMemberActions
                      clubId={club.id}
                      userId={member.user_id}
                      currentRole={member.role}
                      disabled={member.user_id === profile.id}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Teacher/admin access required</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roster.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No active members.</p>
        )}
      </div>
    </div>
  );
}
