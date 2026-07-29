import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getManagedClubBySlug, getClubMemberCount, getClubRoster } from "@/lib/data";
import { requireClubManager } from "@/lib/auth";
import { canAssignClubLeadership, canBanClubMember, canManageClubRoster } from "@/lib/permissions";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RosterMemberActions } from "@/components/manage/roster-member-actions";
import { ClubRoleGuide } from "@/components/manage/club-role-guide";
import { getActivePlatformSupportSession, recordPlatformSupportAccess } from "@/lib/support-access";
import { getSchoolById } from "@/lib/schools";
import { PlatformSupportExpiryGuard } from "@/components/admin/platform-support-expiry-guard";

interface PageProps { params: Promise<{ slug: string }> }

export default async function ManageMembersPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await getManagedClubBySlug(slug);
  if (!club) notFound();
  const { profile, membership } = await requireClubManager(club);
  const supportSession = profile.role === "super_admin"
    ? await getActivePlatformSupportSession(profile, club.school_id)
    : null;
  const supportSchool = profile.role === "super_admin"
    ? await getSchoolById(club.school_id)
    : null;
  const supportAccessRecorded = supportSession
    ? await recordPlatformSupportAccess({
      actor: profile,
      schoolId: club.school_id,
      action: "view",
      resourceType: "club_roster",
      resourceId: club.id,
    })
    : false;
  const canViewRoster = profile.role !== "super_admin" || supportAccessRecorded;
  const [count, roster] = await Promise.all([
    getClubMemberCount(club.id),
    canViewRoster ? getClubRoster(club.id) : Promise.resolve([]),
  ]);
  const canEditRoster = profile.role !== "super_admin"
    && canManageClubRoster(profile, club, membership);
  const canAssignLeadership = profile.role !== "super_admin"
    && canAssignClubLeadership(profile, club, membership);
  const canBan = profile.role !== "super_admin"
    && canBanClubMember(profile, club, membership);

  return (
    <div className="container mx-auto px-4 py-8">
      {supportSession && supportSchool && (
        <PlatformSupportExpiryGuard
          expiresAt={supportSession.expires_at}
          returnTo={`/admin/schools/${supportSchool.slug}/support`}
        />
      )}
      <PageHeader title={`Members — ${club.name}`} description={`${count} people currently joined`} />
      {profile.role === "super_admin" && !canViewRoster && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {supportSession
                  ? "The roster stayed locked because access could not be recorded"
                  : "A support session is required to view this roster"}
              </p>
              <p className="mt-1">
                {supportSession
                  ? "Private information is never shown when the required support audit entry cannot be created. Return to school support and try again."
                  : "The aggregate member count remains available. Start a temporary school support session to inspect names and emails; the access will be time-limited and logged."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={supportSchool
              ? `/admin/schools/${supportSchool.slug}#support-access`
              : "/admin/schools"}>
              Open school support
            </Link>
          </Button>
        </div>
      )}
      {supportSession && supportAccessRecorded && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Read-only support session:</strong> viewing this roster is recorded.
            Roster changes remain disabled for platform administrators.
          </p>
        </div>
      )}
      <ClubRoleGuide />
      {canViewRoster && <div className="overflow-hidden rounded-xl border">
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
                  ) : !canAssignLeadership && member.role !== "member" ? (
                    <span className="text-xs text-muted-foreground">Advisor approval required</span>
                  ) : canEditRoster ? (
                    <RosterMemberActions
                      clubId={club.id}
                      userId={member.user_id}
                      currentRole={member.role}
                      disabled={member.user_id === profile.id}
                      canAssignLeadership={canAssignLeadership}
                      canBan={canBan}
                      canRemove={canAssignLeadership || member.role === "member"}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Roster is view only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roster.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No one has joined this club yet.</p>
        )}
      </div>}
    </div>
  );
}
