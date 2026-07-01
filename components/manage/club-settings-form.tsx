"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { updateClubSettings } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Club, ClubStatus } from "@/types/database";

export function ClubSettingsForm({ club, publishMode = false }: { club: Club; publishMode?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<ClubStatus>(publishMode ? "interest_open" : club.status);
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(
    publishMode ? "public" : club.visibility === "members" || club.visibility === "officers" ? "private" : club.visibility
  );
  const [isListed, setIsListed] = useState(publishMode ? true : club.is_listed);
  const [isFeatured, setIsFeatured] = useState(club.is_featured);
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateClubSettings({
        clubId: club.id,
        name: String(form.get("name") ?? ""),
        category: String(form.get("category") ?? ""),
        shortDescription: String(form.get("short_description") ?? ""),
        longDescription: String(form.get("long_description") ?? ""),
        joinInstructions: String(form.get("join_instructions") ?? ""),
        meetingTime: String(form.get("meeting_time") ?? ""),
        meetingLocation: String(form.get("meeting_location") ?? ""),
        sponsorName: String(form.get("sponsor_name") ?? ""),
        status,
        visibility,
        isListed,
        isFeatured,
      });
      if (result.success) {
        toast({
          title: publishMode ? "Club published" : "Club updated",
          description: result.message || (publishMode ? "Students at this school were notified." : "The club settings were saved."),
        });
        if (publishMode) router.push(`/manage/clubs/${club.slug}`);
        router.refresh();
      } else {
        toast({ title: "Could not update club", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-6 space-y-4">
      {publishMode && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Final publication review</p>
          <p className="mt-1">
            Publishing makes this club visible to students and emails all students at this school with a link to join.
          </p>
        </div>
      )}
      <div><Label htmlFor="name">Club name</Label><Input id="name" name="name" defaultValue={club.name} className="mt-1" required /></div>
      <div><Label htmlFor="category">Category</Label><Input id="category" name="category" defaultValue={club.category ?? ""} placeholder="STEM, Arts, Service..." className="mt-1" /></div>
      <div><Label htmlFor="short_description">Short description</Label><Textarea id="short_description" name="short_description" defaultValue={club.short_description ?? ""} className="mt-1" /></div>
      <div><Label htmlFor="long_description">Full description</Label><Textarea id="long_description" name="long_description" defaultValue={club.long_description ?? ""} rows={5} className="mt-1" /></div>
      <div><Label htmlFor="join_instructions">Join instructions</Label><Textarea id="join_instructions" name="join_instructions" defaultValue={club.join_instructions ?? ""} rows={3} className="mt-1" placeholder="Example: Click Join Club, attend the next meeting, or contact the sponsor." /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="meeting_time">Meeting time</Label><Input id="meeting_time" name="meeting_time" defaultValue={club.meeting_time ?? ""} className="mt-1" /></div>
        <div><Label htmlFor="meeting_location">Meeting location</Label><Input id="meeting_location" name="meeting_location" defaultValue={club.meeting_location ?? ""} className="mt-1" /></div>
      </div>
      <div><Label htmlFor="sponsor_name">Sponsor name</Label><Input id="sponsor_name" name="sponsor_name" defaultValue={club.sponsor_name ?? ""} className="mt-1" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ClubStatus)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm">
            {["draft", "interest_open", "active", "paused", "archived"].map((value) => (
              <option key={value} value={value}>{value.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Visibility</Label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} /> Listed publicly</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : publishMode ? <Send className="h-4 w-4" /> : null}
        {pending ? "Saving..." : publishMode ? "Finalize publication" : "Save changes"}
      </Button>
    </form>
  );
}
