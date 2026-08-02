"use client";

import { useState } from "react";
import { Captcha } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { submitFeedback } from "@/lib/actions";

interface ContactSchool {
  id: string;
  name: string;
}

export function ContactForm({
  schools,
  assignedSchool,
}: {
  schools: ContactSchool[];
  assignedSchool?: ContactSchool | null;
}) {
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await submitFeedback({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      schoolId: String(form.get("schoolId") ?? ""),
      category: String(form.get("category") ?? ""),
      message: String(form.get("message") ?? ""),
      captchaToken,
    });
    setLoading(false);
    if (result.success) {
      toast({
        title: "Message saved in the support inbox",
        description: result.message ?? "An administrator can now review it.",
      });
      formElement.reset();
      setCaptchaToken(null);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6">
      {assignedSchool ? (
        <div>
          <Label>School</Label>
          <p className="mt-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {assignedSchool.name}
          </p>
          <input type="hidden" name="schoolId" value={assignedSchool.id} />
        </div>
      ) : (
        <div>
          <Label htmlFor="schoolId">School</Label>
          <select
            id="schoolId"
            name="schoolId"
            required
            defaultValue=""
            className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="" disabled>Choose your school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            This routes your request only to administrators responsible for that school.
          </p>
        </div>
      )}
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
        <select
          id="category"
          name="category"
          required
          className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
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
      <Captcha onToken={setCaptchaToken} />
      <Button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
