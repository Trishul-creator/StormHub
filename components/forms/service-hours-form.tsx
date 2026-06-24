"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitServiceHours } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";

export function ServiceHoursForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await submitServiceHours({
      title: form.get("title") as string,
      organization: form.get("organization") as string,
      date_completed: form.get("date_completed") as string,
      hours: parseFloat(form.get("hours") as string),
      description: form.get("description") as string,
    });
    setLoading(false);
    if (result.success) {
      toast({ title: "Hours submitted", description: "Your entry is waiting for sponsor or admin review." });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 space-y-4">
      <h2 className="font-semibold text-storm-navy">Log new hours</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Activity title</Label>
          <Input id="title" name="title" required placeholder="e.g. Food bank volunteer" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="organization">Organization</Label>
          <Input id="organization" name="organization" required placeholder="e.g. Local Food Bank" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="date_completed">Date</Label>
          <Input id="date_completed" name="date_completed" type="date" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="hours">Hours</Label>
          <Input id="hours" name="hours" type="number" step="0.5" min="0.5" required className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" placeholder="What did you do?" className="mt-1" />
      </div>
      <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit for review"}</Button>
    </form>
  );
}
