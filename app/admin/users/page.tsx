import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Search } from "lucide-react";
import { GraduationCleanup } from "@/components/admin/graduation-cleanup";
import { UserRoleEditor } from "@/components/admin/user-role-editor";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import {
  ADMIN_USERS_PAGE_SIZE,
  getAdminUsers,
  getManageableClubs,
  isDemoMode,
  normalizeAdminUserSearch,
} from "@/lib/data";
import { canAccessSchoolAdmin, canOpenUserEditor } from "@/lib/permissions";
import {
  getAllSchools,
  getAdminScopeSchools,
  getSchoolBySlug,
  getSchoolForProfile,
} from "@/lib/schools";
import type { UserRole } from "@/types/database";

interface AdminUsersPageProps {
  searchParams: Promise<{ school?: string; q?: string; role?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const { profile } = await requireAdmin();
  const canChooseSchool = profile.role === "district_admin" || profile.role === "super_admin";
  const scopeSchools = canChooseSchool
    ? getAdminScopeSchools(await getAllSchools(), profile)
    : [];
  const requestedSchool = params.school ? await getSchoolBySlug(params.school) : null;
  if (params.school && !requestedSchool) notFound();
  if (
    requestedSchool
    && !canAccessSchoolAdmin(profile, requestedSchool.id, requestedSchool.district_id)
  ) {
    notFound();
  }
  const selectedSchool = requestedSchool
    ?? (profile.role === "admin" ? await getSchoolForProfile(profile) : null);
  const search = normalizeAdminUserSearch(params.q);
  const roleOptions: UserRole[] = ["student", "teacher", "admin", "district_admin", "super_admin"];
  const role = roleOptions.includes(params.role as UserRole)
    ? params.role as UserRole
    : null;
  const requestedPage = /^\d+$/.test(params.page ?? "") ? Number(params.page) : 1;
  const userPage = await getAdminUsers({
    schoolId: selectedSchool?.id,
    search,
    role,
    page: requestedPage,
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
  if (userPage.total > 0 && requestedPage > userPage.totalPages) {
    redirect(usersHref({
      school: selectedSchool?.slug,
      search,
      role,
      page: userPage.totalPages,
    }));
  }

  const clubs = selectedSchool
    ? await getManageableClubs(profile, selectedSchool.id)
    : [];
  const demo = isDemoMode();
  const firstResult = userPage.total === 0
    ? 0
    : ((userPage.page - 1) * userPage.pageSize) + 1;
  const lastResult = Math.min(userPage.total, userPage.page * userPage.pageSize);
  const showOrganization = profile.role === "district_admin" || profile.role === "super_admin";

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Users & Roles"
        description={
          selectedSchool
            ? `All accounts assigned to ${selectedSchool.name}, including school administrators.`
            : profile.role === "district_admin"
              ? "All accounts assigned to your district. Filter to one school when assigning teacher sponsorships."
              : "All platform accounts, including district and platform administrators. Elevated accounts are shown read-only."
        }
      />

      <form
        action="/admin/users"
        method="get"
        className="mb-6 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(14rem,20rem)_auto_auto] md:items-end"
        role="search"
      >
        <label className="text-sm font-medium text-storm-navy">
          Search people
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              name="q"
              type="search"
              defaultValue={search}
              maxLength={100}
              placeholder="Name or email"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-foreground"
            />
          </span>
        </label>
        <label className="text-sm font-medium text-storm-navy">
          Role
          <select
            name="role"
            defaultValue={role ?? ""}
            className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground"
          >
            <option value="">All roles</option>
            {roleOptions.map((option) => (
              <option key={option} value={option}>{option.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        {canChooseSchool && (
          <label className="text-sm font-medium text-storm-navy">
            School scope
            <select
              name="school"
              defaultValue={selectedSchool?.slug ?? ""}
              className="mt-1 block h-10 w-full rounded-lg border bg-background px-3 text-foreground"
            >
              <option value="">
                {profile.role === "district_admin" ? "All district schools" : "All platform schools"}
              </option>
              {scopeSchools.map((school) => (
                <option key={school.id} value={school.slug}>{school.name}</option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit">Apply filters</Button>
        {(search || role || selectedSchool && canChooseSchool) && (
          <Button variant="ghost" asChild>
            <Link href="/admin/users">Clear</Link>
          </Button>
        )}
      </form>

      {!demo && profile.role === "admin" && <GraduationCleanup />}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          Showing {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of{" "}
          {userPage.total.toLocaleString()} users
        </p>
        <p>Page {userPage.page.toLocaleString()} of {userPage.totalPages.toLocaleString()}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-storm-light/50">
            <tr>
              <th className="p-4 text-left font-medium">Name</th>
              <th className="p-4 text-left font-medium">Email</th>
              {showOrganization && <th className="p-4 text-left font-medium">Organization</th>}
              <th className="p-4 text-left font-medium">Role</th>
              <th className="p-4 text-left font-medium">Status</th>
              <th className="p-4 text-left font-medium">Assignments</th>
              <th className="p-4 text-left font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {userPage.users.map((user) => (
              <tr className="border-t" key={user.id}>
                <td className="p-4">{user.full_name || "Unnamed user"}</td>
                <td className="p-4 text-muted-foreground">{user.email || "—"}</td>
                {showOrganization && (
                  <td className="p-4 text-xs">
                    <span className="block">{user.school_name ?? "District/platform account"}</span>
                    {user.district_name && (
                      <span className="text-muted-foreground">{user.district_name}</span>
                    )}
                  </td>
                )}
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
                  ) : !canOpenUserEditor(
                    profile.role,
                    user.role,
                    Boolean(selectedSchool)
                  ) ? (
                    <span className="text-xs text-muted-foreground">
                      {user.role === "district_admin" || user.role === "super_admin"
                        ? "Manage elevated access from the district workspace."
                        : "Choose one school to manage this account."}
                    </span>
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

      {userPage.users.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No user profiles match this scope and search.
        </p>
      )}

      {userPage.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="User inventory pages">
          {userPage.page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={usersHref({
                school: selectedSchool?.slug,
                search,
                role,
                page: userPage.page - 1,
              })}>
                Previous
              </Link>
            </Button>
          ) : <span />}
          {userPage.page < userPage.totalPages && (
            <Button variant="outline" asChild>
              <Link href={usersHref({
                school: selectedSchool?.slug,
                search,
                role,
                page: userPage.page + 1,
              })}>
                Next
              </Link>
            </Button>
          )}
        </nav>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        {demo
          ? "Demo user data is shown. Role changes are unavailable in demo mode."
          : profile.role === "district_admin"
            ? "District administrators can manage student, teacher, and school-admin accounts inside their assigned district."
            : profile.role === "admin"
              ? "School admins can manage student and teacher accounts in their own school."
              : "Platform administrators can manage school-level accounts. District and platform administrator accounts remain read-only in this inventory."}
      </p>
    </div>
  );
}

function usersHref({
  school,
  search,
  role,
  page,
}: {
  school?: string | null;
  search?: string | null;
  role?: UserRole | null;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (school) query.set("school", school);
  if (search) query.set("q", search);
  if (role) query.set("role", role);
  if (page && page > 1) query.set("page", String(page));
  return query.size > 0 ? `/admin/users?${query.toString()}` : "/admin/users";
}
