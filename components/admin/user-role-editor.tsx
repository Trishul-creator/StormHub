"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Select from "@radix-ui/react-select";
import { useRouter } from "next/navigation";
import {
  Ban,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  School,
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

const ROLE_DETAILS: Record<Exclude<UserRole, "super_admin">, {
  label: string;
  description: string;
}> = {
  student: {
    label: "Student",
    description: "Join clubs, complete coursework, and participate in events.",
  },
  teacher: {
    label: "Teacher / Advisor",
    description: "Advise assigned clubs and manage their activities.",
  },
  admin: {
    label: "School administrator",
    description: "Manage users, clubs, and settings for one school.",
  },
  district_admin: {
    label: "District administrator",
    description: "Manage every school inside one assigned district.",
  },
};

function RoleIcon({
  role,
  className,
}: {
  role: Exclude<UserRole, "super_admin">;
  className?: string;
}) {
  if (role === "student") return <GraduationCap className={className} aria-hidden="true" />;
  if (role === "teacher") return <BookOpen className={className} aria-hidden="true" />;
  if (role === "admin") return <School className={className} aria-hidden="true" />;
  return <Building2 className={className} aria-hidden="true" />;
}

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
      const activeSponsorClubIds = user.club_assignments
        .filter((assignment) =>
          assignment.role === "sponsor"
          && assignment.status === "active"
        )
        .map((assignment) => assignment.club_id);
      if (clubs.length === 0) return activeSponsorClubIds;

      const assignableClubIds = new Set(assignableClubs.map((club) => club.id));
      return activeSponsorClubIds.filter((clubId) => assignableClubIds.has(clubId));
    },
    [assignableClubs, clubs.length, user.club_assignments]
  );
  const [clubIds, setClubIds] = useState<string[]>(initialClubIds);
  const [districtId, setDistrictId] = useState(
    user.district_id ?? (districts.length === 1 ? districts[0].id : "")
  );
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
  const roles: Array<Exclude<UserRole, "super_admin">> = actorRole === "super_admin"
    ? [
        "student",
        "teacher",
        "admin",
        ...(districts.length > 0 && (user.account_status ?? "active") === "active"
          ? ["district_admin" as const]
          : []),
      ]
    : actorRole === "district_admin"
      ? ["student", "teacher", "admin"]
      : ["student", "teacher"];

  function requestReauthentication(retry: () => void) {
    retryAfterAuthentication.current = retry;
    setReauthenticationOpen(true);
  }

  function save() {
    if (role === "district_admin") {
      if (!districtId) {
        toast({
          title: "Choose a district",
          description: "A district administrator must be assigned to exactly one district.",
          variant: "destructive",
        });
        return;
      }
      assignDistrictAdministrator(districtId);
      return;
    }

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
              ? "This elevated account is protected from school-level role changes."
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

  const selectedRole = role === "super_admin" ? "admin" : role;
  const selectedRoleDetails = ROLE_DETAILS[selectedRole];
  const selectedDistrict = districts.find((district) => district.id === districtId);

  return (
    <div className="min-w-72 space-y-2.5">
      <Select.Root
        value={selectedRole}
        onValueChange={(value) => setRole(value as UserRole)}
        disabled={pending}
      >
        <Select.Trigger
          aria-label={`Role for ${user.full_name || user.email || "user"}`}
          className="group flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-2 text-left text-foreground shadow-sm outline-none transition hover:border-storm-electric/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-storm-electric/40 data-[state=open]:border-storm-electric/50 data-[state=open]:ring-2 data-[state=open]:ring-storm-electric/20"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-storm-electric/10 text-storm-electric">
            <RoleIcon role={selectedRole} className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{selectedRoleDetails.label}</span>
            <span className="block text-[11px] text-muted-foreground">Account role</span>
          </span>
          <Select.Icon asChild>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            align="end"
            sideOffset={6}
            collisionPadding={12}
            className="z-[70] w-[var(--radix-select-trigger-width)] min-w-80 overflow-hidden rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-2xl"
          >
            <Select.Viewport>
              <Select.Group>
                <Select.Label className="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Choose account role
                </Select.Label>
                {roles.map((option) => {
                  const details = ROLE_DETAILS[option];
                  return (
                    <Select.Item
                      key={option}
                      value={option}
                      className="relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2.5 pr-9 outline-none transition data-[highlighted]:bg-muted data-[state=checked]:bg-storm-electric/10"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-storm-electric">
                        <RoleIcon role={option} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <Select.ItemText>
                          <span className="block text-sm font-semibold">{details.label}</span>
                        </Select.ItemText>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                          {details.description}
                        </span>
                      </span>
                      <Select.ItemIndicator className="absolute right-3 inline-flex items-center text-storm-electric">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  );
                })}
              </Select.Group>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {selectedRole === "district_admin" && (
        <div className="rounded-xl border border-violet-300/70 bg-violet-500/5 p-2.5 dark:border-violet-800/80 dark:bg-violet-950/20">
          <p className="mb-2 text-xs font-semibold text-foreground">Assigned district</p>
          <Select.Root value={districtId} onValueChange={setDistrictId} disabled={pending}>
            <Select.Trigger
              aria-label={`District for ${user.full_name || user.email || "user"}`}
              className="flex h-10 w-full items-center gap-2 rounded-lg border bg-background px-3 text-left text-sm text-foreground shadow-sm outline-none transition hover:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500/30"
            >
              <Building2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {selectedDistrict?.name ?? "Choose a district"}
              </span>
              <Select.Icon asChild>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                align="end"
                sideOffset={6}
                collisionPadding={12}
                className="z-[80] max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl"
              >
                <Select.Viewport>
                  <Select.Group>
                    <Select.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      One district is required
                    </Select.Label>
                    {districts.map((district) => (
                      <Select.Item
                        key={district.id}
                        value={district.id}
                        className="relative cursor-pointer select-none rounded-lg py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:bg-violet-500/10"
                      >
                        <Select.ItemText>{district.name}</Select.ItemText>
                        <Select.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-600 dark:text-violet-300">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Promotion removes school and club assignments and grants district-wide administration.
          </p>
        </div>
      )}

      {selectedRole === "teacher" && (
        <div className="flex flex-wrap items-center gap-2">
          {clubs.length > 0 ? (
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
          ) : (
            <span className="text-xs leading-snug text-muted-foreground">
              Select one school in the page filters to edit Advisor club assignments.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={save}
          disabled={pending || (selectedRole === "district_admin" && !districtId)}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
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
