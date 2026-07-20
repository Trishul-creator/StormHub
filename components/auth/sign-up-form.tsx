"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseSignUp } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

interface SignUpSchool {
  id: string;
  name: string;
  short_name?: string | null;
  slug: string;
}

export function SignUpForm({
  schools,
  preselectedSchoolId,
  requiresAccessCode = false,
}: {
  schools: SignUpSchool[];
  preselectedSchoolId?: string | null;
  requiresAccessCode?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadedAt] = useState(() => Date.now());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const fullName = form.get("fullName") as string;
    const gradeLevelRaw = String(form.get("gradeLevel") ?? "");
    const accessCode = String(form.get("accessCode") ?? "");
    const schoolId = String(form.get("schoolId") ?? "");
    const website = String(form.get("website") ?? "");
    const formLoadedAt = Number(form.get("loadedAt") ?? 0);

    if (website || !formLoadedAt || Date.now() - formLoadedAt < 1500) {
      setLoading(false);
      toast({ title: "Sign up failed", description: "Please try again.", variant: "destructive" });
      return;
    }
    if (fullName.trim().length < 3) {
      setLoading(false);
      toast({ title: "Sign up failed", description: "Enter your full name.", variant: "destructive" });
      return;
    }
    if (!schoolId) {
      setLoading(false);
      toast({ title: "Sign up failed", description: "Choose your school.", variant: "destructive" });
      return;
    }
    const result = await supabaseSignUp(
      email,
      password,
      fullName,
      gradeLevelRaw ? Number(gradeLevelRaw) : null,
      accessCode,
      schoolId,
      { website, loadedAt: formLoadedAt }
    );
    setLoading(false);
    if (result.success) {
      if (result.needsConfirmation) {
        toast({ title: "Check your email", description: "Confirm your email address to complete signup." });
        router.push("/auth/sign-in");
      } else {
        toast({ title: "Welcome to StormHub!", description: "Your account has been created." });
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      toast({ title: "Sign up failed", description: result.error, variant: "destructive" });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <CardTitle>Join StormHub</CardTitle>
        <CardDescription>Create your account for your school workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="schoolId">School</Label>
            <select
              id="schoolId"
              name="schoolId"
              required
              defaultValue={preselectedSchoolId ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose your school</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required placeholder="Your name" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@school.edu" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="gradeLevel">Grade</Label>
            <select
              id="gradeLevel"
              name="gradeLevel"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
            >
              <option value="">Select grade</option>
              {[9, 10, 11, 12].map((grade) => (
                <option key={grade} value={grade}>{grade}th grade</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} className="mt-1" />
          </div>
          {requiresAccessCode && (
            <div>
              <Label htmlFor="accessCode">School signup code</Label>
              <Input id="accessCode" name="accessCode" required autoComplete="one-time-code" className="mt-1" />
            </div>
          )}
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <input type="hidden" name="loadedAt" value={loadedAt} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-storm-electric hover:underline">Sign in</Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Confirm your email after signup. New accounts are tied to one school workspace, and staff roles are assigned by authorized administrators.
        </p>
      </CardContent>
    </Card>
  );
}
