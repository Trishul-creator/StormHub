"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptCurrentPolicies } from "@/lib/actions";
import { HIGH_SCHOOL_AGE_ASSURANCE, POLICY_EFFECTIVE_DATE } from "@/lib/policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function PolicyAcceptanceForm({ next }: { next: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await acceptCurrentPolicies({
      acceptedPolicies: form.get("policyAccepted") === "on",
      ageAssurance: form.get("ageAssurance") === "on"
        ? HIGH_SCHOOL_AGE_ASSURANCE
        : undefined,
      next,
    });
    setLoading(false);
    if (!result.success) {
      toast({
        title: "Could not continue",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Preferences saved",
      description: "Thank you for reviewing StormHub's school-use policies.",
    });
    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Review the school-use policies</CardTitle>
        <CardDescription>
          StormHub updated its policies on {POLICY_EFFECTIVE_DATE}. Review and acknowledge them
          once to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            StormHub is currently limited to high-school communities and people age 13 or older.
            It does not ask for your birth date, sell student information, or use student
            information for targeted advertising. External AI processing remains disabled.
          </div>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              name="ageAssurance"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span>I confirm that I am at least 13 and authorized to use this high-school workspace.</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              name="policyAccepted"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span>
              I will use StormHub for school purposes and agree to the{" "}
              <Link href="/acceptable-use" target="_blank" className="text-storm-electric hover:underline">
                Acceptable Use Policy
              </Link>
              ,{" "}
              <Link href="/terms" target="_blank" className="text-storm-electric hover:underline">
                Terms
              </Link>
              , and acknowledge the{" "}
              <Link href="/privacy" target="_blank" className="text-storm-electric hover:underline">
                Student Privacy Notice
              </Link>
              .
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Accept and continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
