"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateClubSettings } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Club, ClubStatus } from "@/types/database";

export function ClubSettingsForm({ club }: { club: Club }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<ClubStatus>(club.status);
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(
    club.visibility === "members" || club.visibility === "officers" ? "private" : club.visibility
  );
  const [isListed, setIsListed] = useState(club.is_listed);
  const [isFeatured, setIsFeatured] = useState(club.is_featured);
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateClubSettings({
        clubId: club.id,
        name: String(form.get("name") ?? ""),
        shortDescription: String(form.get("short_description") ?? ""),
        meetingTime: String(form.get("meeting_time") ?? ""),
        meetingLocation: String(form.get("meeting_location") ?? ""),
        sponsorName: String(form.get("sponsor_name") ?? ""),
        status,
        visibility,
        isListed,
        isFeatured,
      });
      if (result.success) {
        toast({ title: "Club updated", description: "The club settings were saved." });
        router.refresh();
      } else {
        toast({ title: "Could not update club", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-6 space-y-4">
      <div><Label htmlFor="name">Club name</Label><Input id="name" name="name" defaultValue={club.name} className="mt-1" required /></div>
      <div><Label htmlFor="short_description">Short description</Label><Textarea id="short_description" name="short_description" defaultValue={club.short_description ?? ""} className="mt-1" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="meeting_time">Meeting time</Label><Input id="meeting_time" name="meeting_time" defaultValue={club.meeting_time ?? ""} className="mt-1" /></div>
        <div><Label htmlFor="meeting_location">Meeting location</Label><Input id="meeting_location" name="meeting_location" defaultValue={club.meeting_location ?? ""} className="mt-1" /></div>
      </div>
      <div><Label htmlFor="sponsor_name">Sponsor name</Label><Input id="sponsor_name" name="sponsor_name" defaultValue={club.sponsor_name ?? ""} className="mt-1" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ClubStatus)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm">
            {["draft", "interest_open", "active", "paused", "archived"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <Label>Visibility</Label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="public">public</option><option value="unlisted">unlisted</option><option value="private">private</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} /> Listed publicly</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
      </div>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
    </form>
  );
}
