"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitWorkshop } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";

export function WorkshopSubmitForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitWorkshop({
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        subject_area: String(form.get("subject_area") ?? ""),
        skill_level: String(form.get("skill_level") ?? ""),
        starts_at: String(form.get("starts_at") ?? "") || undefined,
        location: String(form.get("location") ?? "") || undefined,
      });
      if (result.success) {
        toast({ title: "Workshop submitted", description: "An admin or teacher will review it before it appears publicly." });
        router.push("/workshops");
        router.refresh();
      } else {
        toast({ title: "Could not submit workshop", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-6 space-y-4">
      <div>
        <Label htmlFor="title">Workshop title</Label>
        <Input id="title" name="title" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required rows={5} className="mt-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="subject_area">Subject area</Label>
          <Input id="subject_area" name="subject_area" placeholder="Math, Science, Writing..." required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="skill_level">Skill level</Label>
          <Input id="skill_level" name="skill_level" placeholder="Beginner, AP, competition..." required className="mt-1" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="starts_at">Date/time</Label>
          <Input id="starts_at" name="starts_at" type="datetime-local" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" className="mt-1" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Submitting..." : "Submit workshop"}</Button>
    </form>
  );
}
