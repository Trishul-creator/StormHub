"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { updateClubMember } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { MembershipRole } from "@/types/database";

export function RosterMemberActions({
  clubId,
  userId,
  currentRole,
  disabled,
}: {
  clubId: string;
  userId: string;
  currentRole: MembershipRole;
  disabled?: boolean;
}) {
  const [role, setRole] = useState<MembershipRole>(currentRole);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateClubMember({ clubId, userId, role });
      if (result.success) {
        toast({ title: "Roster updated", description: "The member’s club role was saved." });
        router.refresh();
      } else {
        toast({ title: "Could not update member", description: result.error, variant: "destructive" });
      }
    });
  }

  function remove() {
    if (!window.confirm("Remove this person from the club roster?")) return;
    startTransition(async () => {
      const result = await updateClubMember({ clubId, userId, remove: true });
      if (result.success) {
        toast({ title: "Member removed", description: "The person was removed from the active roster." });
        router.refresh();
      } else {
        toast({ title: "Could not remove member", description: result.error, variant: "destructive" });
      }
    });
  }

  function ban() {
    if (!window.confirm("Ban this student from rejoining this club? Use this only for roster abuse or spam.")) return;
    startTransition(async () => {
      const result = await updateClubMember({ clubId, userId, ban: true });
      if (result.success) {
        toast({ title: "Member banned", description: "The student was removed and cannot rejoin this club." });
        router.refresh();
      } else {
        toast({ title: "Could not ban member", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as MembershipRole)}
        disabled={disabled || pending}
        className="h-8 rounded-md border bg-white px-2 text-xs"
      >
        <option value="member">Member</option>
        <option value="officer">Officer</option>
        <option value="president">President</option>
      </select>
      <Button size="sm" variant="outline" onClick={save} disabled={disabled || pending}>
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        Save
      </Button>
      <Button size="sm" variant="destructive" onClick={remove} disabled={disabled || pending}>
        <Trash2 className="h-3 w-3" /> Remove
      </Button>
      <Button size="sm" variant="destructive" onClick={ban} disabled={disabled || pending}>
        Ban
      </Button>
    </div>
  );
}
