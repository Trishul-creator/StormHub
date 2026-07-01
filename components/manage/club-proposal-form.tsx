"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MeetingTimeInput } from "@/components/manage/meeting-time-input";
import { submitClubProposal } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/types/database";

export function ClubProposalForm({
  requiresApproval = true,
  teachers = [],
  defaultSponsorUserId,
}: {
  requiresApproval?: boolean;
  teachers?: Profile[];
  defaultSponsorUserId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitClubProposal({
        name: String(form.get("name") ?? ""),
        shortDescription: String(form.get("shortDescription") ?? ""),
        category: String(form.get("category") ?? ""),
        meetingTime: String(form.get("meetingTime") ?? ""),
        meetingLocation: String(form.get("meetingLocation") ?? ""),
        sponsorUserId: String(form.get("sponsorUserId") ?? ""),
      });
      if (result.success) {
        toast({
          title: requiresApproval ? "Club proposal submitted" : "Draft club created",
          description: result.message || (requiresApproval
            ? "A school admin can review and publish it."
            : "Review the draft details, then publish it when ready."),
        });
        router.push(requiresApproval ? "/manage/clubs" : "/manage/clubs/drafts");
        router.refresh();
      } else {
        toast({ title: "Could not submit club", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-6 space-y-4">
      <div>
        <Label htmlFor="name">Club name</Label>
        <Input id="name" name="name" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="shortDescription">Short description</Label>
        <Textarea id="shortDescription" name="shortDescription" required rows={3} className="mt-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="STEM, Service, Arts..." required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="sponsorUserId">Teacher sponsor</Label>
          <select
            id="sponsorUserId"
            name="sponsorUserId"
            defaultValue={defaultSponsorUserId ?? ""}
            className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">No sponsor assigned yet</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name || teacher.email || "Unnamed teacher"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MeetingTimeInput id="meetingTime" name="meetingTime" />
        <div>
          <Label htmlFor="meetingLocation">Meeting location</Label>
          <Input id="meetingLocation" name="meetingLocation" placeholder="Room 123" className="mt-1" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting..." : requiresApproval ? "Submit proposal" : "Create draft club"}
      </Button>
    </form>
  );
}
