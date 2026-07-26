import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers, isDemoMode } from "@/lib/data";
import { getManageableClubs } from "@/lib/data";
import { UserRoleEditor } from "@/components/admin/user-role-editor";
import { getSchoolBySlug } from "@/lib/schools";
import { GraduationCleanup } from "@/components/admin/graduation-cleanup";

interface AdminUsersPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const { profile } = await requireAdmin();
  const selectedSchool = profile.role === "super_admin" && params.school ? await getSchoolBySlug(params.school) : null;
  const users = await getAdminUsers(selectedSchool?.id);
  const clubs = await getManageableClubs(profile, selectedSchool?.id);
  const demo = isDemoMode();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Users & Roles"
        description={
          selectedSchool
            ? `School inventory for ${selectedSchool.name}. Platform admins are intentionally excluded.`
            : "Manage user roles and permissions. Platform admins are intentionally excluded from school inventory."
        }
      />
      {!demo && <GraduationCleanup />}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-storm-light/50">
            <tr>
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Email</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Assignments</th>
              <th className="text-left p-4 font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-t" key={user.id}>
                <td className="p-4">{user.full_name || "Unnamed user"}</td>
                <td className="p-4 text-muted-foreground">{user.email || "—"}</td>
                <td className="p-4"><RoleBadge role={user.role} /></td>
                <td className="p-4 capitalize">
                  {user.account_status === "suspended" ? "banned" : user.account_status ?? "active"}
                </td>
                <td className="p-4 text-xs text-muted-foreground">
                  {user.club_assignments
                    .filter((assignment) => assignment.status === "active" && assignment.role !== "member")
                    .map((assignment) => `${assignment.club_name} (${assignment.role})`)
                    .join(", ") || "—"}
                </td>
                <td className="p-4">
                  {demo ? (
                    <span className="text-xs text-muted-foreground">Unavailable in demo mode</span>
                  ) : (
                    <UserRoleEditor
                      user={user}
                      clubs={clubs}
                      actorId={profile.id}
                      actorRole={profile.role}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No user profiles were found.</p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        {demo
          ? "Demo user data is shown. Role changes are unavailable in demo mode."
          : "Admins can assign students or teachers. Only super admins can modify admin-level accounts."}
      </p>
    </div>
  );
}
