"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitClubProposal } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/types/database";

export function ClubProposalForm({
  requiresApproval = true,
  teachers = [],
  defaultSponsorUserId,
  targetSchoolId,
  returnHref = "/manage/clubs/drafts",
  successHref,
}: {
  requiresApproval?: boolean;
  teachers?: Profile[];
  defaultSponsorUserId?: string;
  targetSchoolId: string;
  returnHref?: string;
  successHref?: string;
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
        sponsorUserId: String(form.get("sponsorUserId") ?? ""),
        schoolId: targetSchoolId,
      });
      if (result.success) {
        toast({
          title: requiresApproval ? "Club proposal submitted" : "Draft club created",
          description: result.message || (requiresApproval
            ? "A school admin can review and publish it."
            : "Review the draft details, then publish it when ready."),
        });
        router.push(successHref ?? (requiresApproval ? "/manage/clubs" : returnHref));
        router.refresh();
      } else {
        toast({ title: "Could not submit club", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6">
      <div>
        <Label htmlFor="name">Club name</Label>
        <Input id="name" name="name" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="shortDescription">Short description</Label>
        <Textarea id="shortDescription" name="shortDescription" required rows={3} className="mt-1" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="STEM, Service, Arts..." required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="sponsorUserId">Club Advisor</Label>
          <select
            id="sponsorUserId"
            name="sponsorUserId"
            defaultValue={defaultSponsorUserId ?? ""}
            className="mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground"
          >
            <option value="">No Advisor assigned yet</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name || teacher.email || "Unnamed teacher"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
        Add dated meetings later from the club dashboard using Create Event. Club setup only creates the club profile.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting..." : requiresApproval ? "Submit custom club proposal" : "Create custom club"}
      </Button>
    </form>
  );
}
