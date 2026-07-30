"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { deleteUserAccount, updateUserAccountStatus, updateUserRoleAndClubs } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getSponsorAssignableClubs } from "@/lib/permissions";
import type { AdminUser, Club, UserRole } from "@/types/database";

export function UserRoleEditor({
  user,
  clubs,
  actorId,
  actorRole,
}: {
  user: AdminUser;
  clubs: Club[];
  actorId: string;
  actorRole: UserRole;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const assignableClubs = useMemo(
    () => getSponsorAssignableClubs(clubs, user.school_id),
    [clubs, user.school_id]
  );
  const initialClubIds = useMemo(
    () => {
      const assignableClubIds = new Set(assignableClubs.map((club) => club.id));
      return user.club_assignments
        .filter((assignment) =>
          assignment.role === "sponsor"
          && assignment.status === "active"
          && assignableClubIds.has(assignment.club_id)
        )
        .map((assignment) => assignment.club_id);
    },
    [assignableClubs, user.club_assignments]
  );
  const [clubIds, setClubIds] = useState<string[]>(initialClubIds);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isSelf = user.id === actorId;
  const editableTargetRoles = actorRole === "district_admin"
    ? ["student", "teacher", "admin"]
    : ["student", "teacher"];
  const elevatedTarget = user.role === "district_admin" || user.role === "super_admin";
  const protectedTarget = elevatedTarget
    || (actorRole !== "super_admin" && !editableTargetRoles.includes(user.role));
  const canDelete = !isSelf && !protectedTarget;
  const roles: UserRole[] = actorRole === "super_admin" || actorRole === "district_admin"
    ? ["student", "teacher", "admin"]
    : ["student", "teacher"];

  function toggleClub(clubId: string) {
    setClubIds((current) =>
      current.includes(clubId)
        ? current.filter((id) => id !== clubId)
        : [...current, clubId]
    );
  }

  function save() {
    startTransition(async () => {
      const result = await updateUserRoleAndClubs({
        targetUserId: user.id,
        role,
        clubIds,
      });
      if (result.success) {
        toast({ title: "User updated", description: "Role and club assignments were saved." });
        router.refresh();
      } else {
        toast({ title: "Could not update user", description: result.error, variant: "destructive" });
      }
    });
  }

  function removeUser() {
    const confirmed = window.confirm(
      `Delete ${user.full_name || user.email || "this user"} from StormHub? This removes their account, memberships, RSVPs, bookmarks, notifications, and profile. This cannot be undone.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteUserAccount(user.id);
      if (result.success) {
        toast({ title: "User deleted", description: "The account was removed from StormHub." });
        router.refresh();
      } else {
        toast({ title: "Could not delete user", description: result.error, variant: "destructive" });
      }
    });
  }

  function changeStatus(status: "active" | "suspended") {
    if (status === "suspended" && !window.confirm(
      `Ban ${user.full_name || user.email || "this account"}? They will be signed out and unable to sign in until an administrator restores the account.`
    )) return;
    startTransition(async () => {
      const result = await updateUserAccountStatus(user.id, status);
      if (result.success) {
        toast({ title: status === "active" ? "Account restored" : "Account banned" });
        router.refresh();
      } else {
        toast({ title: "Could not update account", description: result.error, variant: "destructive" });
      }
    });
  }

  if (isSelf || protectedTarget) {
    return (
      <div className="space-y-2">
        <span className="block text-xs text-muted-foreground">
          {isSelf
            ? "Your own account cannot be changed here."
            : elevatedTarget
              ? "Manage this elevated assignment from the district workspace."
              : "A higher-level administrator must modify this account."}
        </span>
        {canDelete && (
          <Button size="sm" variant="destructive" onClick={removeUser} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete user
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-64 space-y-3">
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as UserRole)}
        className="flex h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
      >
        {roles.map((option) => (
          <option key={option} value={option}>{option.replace("_", " ")}</option>
        ))}
      </select>

      {role === "teacher" && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
          <p className="mb-1 text-xs font-medium">Assigned clubs <span className="font-normal text-muted-foreground">(optional)</span></p>
          {assignableClubs.map((club) => (
            <label key={club.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={clubIds.includes(club.id)}
                onChange={() => toggleClub(club.id)}
              />
              {club.name}
            </label>
          ))}
          {assignableClubs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No published, active clubs are available in this teacher&apos;s school.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save role
        </Button>
        {user.account_status === "suspended" || user.account_status === "deactivated" ? (
          <Button size="sm" variant="outline" onClick={() => changeStatus("active")} disabled={pending}>
            <CheckCircle2 className="h-4 w-4" /> Restore account
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => changeStatus("suspended")} disabled={pending}>
            <Ban className="h-4 w-4" /> Ban account
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={removeUser} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete user
        </Button>
      </div>
    </div>
  );
}
