"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeGoogleOnboarding } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface OnboardingSchool {
  id: string;
  name: string;
}

export function GoogleOnboardingForm({
  schools,
  email,
  suggestedName,
  next,
  requiresAccessCode,
}: {
  schools: OnboardingSchool[];
  email: string;
  suggestedName: string;
  next: string;
  requiresAccessCode: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await completeGoogleOnboarding({
      schoolId: String(form.get("schoolId") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      gradeLevel: String(form.get("gradeLevel") ?? ""),
      accessCode: String(form.get("accessCode") ?? ""),
      next,
    });
    setLoading(false);

    if (!result.success) {
      toast({
        title: "Could not finish signup",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Welcome to StormHub", description: "Your school workspace is ready." });
    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Finish setting up your account</CardTitle>
        <CardDescription>
          Google verified <span className="font-medium text-foreground">{email}</span>. Choose the school workspace this account belongs to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="google-schoolId">School</Label>
            <select
              id="google-schoolId"
              name="schoolId"
              required
              defaultValue=""
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose your school</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="google-fullName">Full name</Label>
            <Input
              id="google-fullName"
              name="fullName"
              required
              minLength={3}
              maxLength={120}
              defaultValue={suggestedName}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="google-gradeLevel">Grade</Label>
            <select
              id="google-gradeLevel"
              name="gradeLevel"
              defaultValue=""
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select grade</option>
              {[9, 10, 11, 12].map((grade) => (
                <option key={grade} value={grade}>{grade}th grade</option>
              ))}
            </select>
          </div>
          {requiresAccessCode && (
            <div>
              <Label htmlFor="google-accessCode">School signup code</Label>
              <Input id="google-accessCode" name="accessCode" required autoComplete="one-time-code" className="mt-1" />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || schools.length === 0}>
            {loading ? "Finishing setup..." : "Continue to StormHub"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your verified Google email must match the accepted-email settings for the school you choose.
        </p>
      </CardContent>
    </Card>
  );
}
