"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileSettings } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/types/database";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [gradeLevel, setGradeLevel] = useState(profile.grade_level?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateProfileSettings({
        fullName,
        gradeLevel: gradeLevel ? Number(gradeLevel) : null,
      });
      if (result.success) {
        toast({ title: "Profile updated", description: "Your settings were saved." });
        router.refresh();
      } else {
        toast({ title: "Could not update profile", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="gradeLevel">Grade</Label>
          <select
            id="gradeLevel"
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus-visible:border-storm-electric/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">Not set</option>
            {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
              <option key={grade} value={grade}>{grade}th grade</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="mt-1 break-all text-sm font-medium text-storm-navy">{profile.email ?? "—"}</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="mt-1 text-sm font-medium capitalize text-storm-navy">{profile.role.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          StormHub stores only what is needed for participation, including private club coursework when your club uses assignments.
        </p>
        <Button className="shrink-0" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
