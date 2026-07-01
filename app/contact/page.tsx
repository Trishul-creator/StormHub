"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "stormhubsupport@gmail.com";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await submitFeedback({
      name: form.get("name") as string,
      email: form.get("email") as string,
      category: form.get("category") as string,
      message: form.get("message") as string,
    });
    setLoading(false);
    if (result.success) {
      toast({ title: "Message sent!", description: "Thank you for your feedback." });
      (e.target as HTMLFormElement).reset();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <PageHeader
        title="Contact & Feedback"
        description="Share feedback, report issues, or suggest improvements for StormHub."
      />
      <div className="mb-6 rounded-xl border border-storm-light bg-storm-light/30 p-4 text-sm text-muted-foreground">
        <p>
          Need help with a bug, account issue, or something urgent? Email{" "}
          <a className="font-medium text-storm-electric underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-2">
          You can also use the form below. Messages are emailed to StormHub support.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" name="name" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" required className="mt-1 flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="app-feedback">App feedback / support</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="club">Club-related</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" name="message" required rows={5} className="mt-1" />
        </div>
        <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send message"}</Button>
      </form>
    </div>
  );
}
