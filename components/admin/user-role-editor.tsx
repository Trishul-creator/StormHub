"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  assignUserToDistrictAdministrator,
  deleteUserAccount,
  updateUserAccountStatus,
  updateUserRoleAndClubs,
} from "@/lib/actions";
import { AdminReauthenticationDialog } from "@/components/auth/admin-reauthentication-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { needsAdminReauthentication } from "@/lib/admin-step-up-shared";
import { getSponsorAssignableClubs } from "@/lib/permissions";
import type { AdminUser, Club, UserRole } from "@/types/database";

export function UserRoleEditor({
  user,
  clubs,
  actorId,
  actorRole,
  actorEmail,
  districts = [],
  accountActionsOnly = false,
}: {
  user: AdminUser;
  clubs: Club[];
  actorId: string;
  actorRole: UserRole;
  actorEmail: string;
  districts?: Array<{ id: string; name: string }>;
  accountActionsOnly?: boolean;
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
  const [reauthenticationOpen, setReauthenticationOpen] = useState(false);
  const retryAfterAuthentication = useRef<(() => void) | null>(null);
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

  function requestReauthentication(retry: () => void) {
    retryAfterAuthentication.current = retry;
    setReauthenticationOpen(true);
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
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(save);
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
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(removeUserAfterConfirmation);
      } else {
        toast({ title: "Could not delete user", description: result.error, variant: "destructive" });
      }
    });
  }

  function removeUserAfterConfirmation() {
    startTransition(async () => {
      const result = await deleteUserAccount(user.id);
      if (result.success) {
        toast({ title: "User deleted", description: "The account was removed from StormHub." });
        router.refresh();
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(removeUserAfterConfirmation);
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
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(() => changeStatusAfterConfirmation(status));
      } else {
        toast({ title: "Could not update account", description: result.error, variant: "destructive" });
      }
    });
  }

  function changeStatusAfterConfirmation(status: "active" | "suspended") {
    startTransition(async () => {
      const result = await updateUserAccountStatus(user.id, status);
      if (result.success) {
        toast({ title: status === "active" ? "Account restored" : "Account banned" });
        router.refresh();
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(() => changeStatusAfterConfirmation(status));
      } else {
        toast({ title: "Could not update account", description: result.error, variant: "destructive" });
      }
    });
  }

  function assignDistrictAdministrator(districtId: string) {
    const district = districts.find((option) => option.id === districtId);
    if (!district || !window.confirm(
      `Promote ${user.full_name || user.email || "this user"} to district administrator for ${district.name}? Their school and club assignments will be removed.`
    )) return;
    assignDistrictAdministratorAfterConfirmation(districtId);
  }

  function assignDistrictAdministratorAfterConfirmation(districtId: string) {
    startTransition(async () => {
      const result = await assignUserToDistrictAdministrator({
        targetUserId: user.id,
        districtId,
      });
      if (result.success) {
        toast({
          title: "District administrator assigned",
          description: `${user.full_name || user.email || "The user"} now manages one district.`,
        });
        router.refresh();
      } else if (needsAdminReauthentication(result)) {
        requestReauthentication(() => assignDistrictAdministratorAfterConfirmation(districtId));
      } else {
        toast({
          title: "Could not assign district administrator",
          description: result.error,
          variant: "destructive",
        });
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

  const accountActions = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`Account actions for ${user.full_name || user.email || "user"}`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          )}
          Account
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Account access
          </DropdownMenu.Label>
          {user.account_status === "suspended" || user.account_status === "deactivated" ? (
            <DropdownMenu.Item
              onSelect={() => changeStatus("active")}
              className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Restore account
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              onSelect={() => changeStatus("suspended")}
              className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted"
            >
              <Ban className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Ban account
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {actorRole === "super_admin"
            && districts.length > 0
            && (user.account_status ?? "active") === "active"
            && (
            <>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted">
                  <ShieldCheck className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  Assign district admin
                  <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-[60] max-h-72 min-w-64 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
                  >
                    <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Choose the one district to manage
                    </DropdownMenu.Label>
                    {districts.map((district) => (
                      <DropdownMenu.Item
                        key={district.id}
                        onSelect={() => assignDistrictAdministrator(district.id)}
                        className="cursor-pointer select-none rounded-lg px-2 py-2 text-sm outline-none focus:bg-muted"
                      >
                        {district.name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
            </>
          )}
          <DropdownMenu.Item
            onSelect={removeUser}
            className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive outline-none focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete user
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  if (accountActionsOnly) {
    return (
      <>
        {accountActions}
        <AdminReauthenticationDialog
          open={reauthenticationOpen}
          onOpenChange={setReauthenticationOpen}
          email={actorEmail}
          onVerified={() => retryAfterAuthentication.current?.()}
        />
      </>
    );
  }

  return (
    <div className="min-w-60 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Role for ${user.full_name || user.email || "user"}`}
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="h-9 min-w-32 flex-1 rounded-lg border bg-background px-3 text-sm text-foreground"
        >
          {roles.map((option) => (
            <option key={option} value={option}>{option.replace("_", " ")}</option>
          ))}
        </select>

        {role === "teacher" && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Choose Advisor clubs for ${user.full_name || user.email || "user"}`}
              >
                Clubs
                {clubIds.length > 0 && (
                  <span className="rounded-full bg-storm-electric/10 px-1.5 text-xs text-storm-electric">
                    {clubIds.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                collisionPadding={12}
                className="z-50 max-h-72 w-72 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
              >
                <DropdownMenu.Label className="px-2 py-1.5">
                  <span className="block text-sm font-semibold">Advisor clubs</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Published clubs in this teacher&apos;s school
                  </span>
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                {assignableClubs.map((club) => (
                  <DropdownMenu.CheckboxItem
                    key={club.id}
                    checked={clubIds.includes(club.id)}
                    onCheckedChange={(checked) => {
                      setClubIds((current) => checked === true
                        ? current.includes(club.id) ? current : [...current, club.id]
                        : current.filter((id) => id !== club.id));
                    }}
                    onSelect={(event) => event.preventDefault()}
                    className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none focus:bg-muted"
                  >
                    <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex items-center">
                      <Check className="h-4 w-4 text-storm-electric" aria-hidden="true" />
                    </DropdownMenu.ItemIndicator>
                    <span className="truncate">{club.name}</span>
                  </DropdownMenu.CheckboxItem>
                ))}
                {assignableClubs.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No published, active clubs are available in this teacher&apos;s school.
                  </p>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save role
        </Button>
        {accountActions}
      </div>
      <AdminReauthenticationDialog
        open={reauthenticationOpen}
        onOpenChange={setReauthenticationOpen}
        email={actorEmail}
        onVerified={() => retryAfterAuthentication.current?.()}
      />
    </div>
  );
}
