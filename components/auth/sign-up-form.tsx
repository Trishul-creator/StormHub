"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseResendConfirmation, supabaseSignUp } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { MailCheck, Zap } from "lucide-react";
import { Captcha } from "@/components/auth/captcha";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

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
      { website, loadedAt: formLoadedAt, captchaToken }
    );
    setLoading(false);
    if (result.success) {
      if (result.needsConfirmation) {
        toast({ title: "Check your email", description: "Confirm your email address to complete signup." });
        setPendingEmail(email.trim().toLowerCase());
      } else {
        toast({ title: "Welcome to StormHub!", description: "Your account has been created." });
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      toast({ title: "Sign up failed", description: result.error, variant: "destructive" });
    }
  }

  if (pendingEmail) {
    return <EmailVerificationNotice email={pendingEmail} />;
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
            <Input id="password" name="password" type="password" required minLength={12} className="mt-1" />
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
          <Captcha onToken={setCaptchaToken} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-storm-electric underline">Sign in</Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Confirm your email after signup. New accounts are tied to one school workspace, and staff roles are assigned by authorized administrators.
        </p>
      </CardContent>
    </Card>
  );
}

function EmailVerificationNotice({ email }: { email: string }) {
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim());

  async function resendConfirmation() {
    setResending(true);
    const result = await supabaseResendConfirmation(email, captchaToken);
    setResending(false);
    toast(
      result.success
        ? { title: "Confirmation sent", description: "Check your inbox for a new verification link." }
        : { title: "Could not resend email", description: result.error, variant: "destructive" }
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
          <MailCheck className="h-5 w-5 text-white" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Open the link to verify your email and finish creating your account. Check your spam folder if it does not arrive.
        </p>
        <Captcha onToken={setCaptchaToken} />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={resending || (captchaRequired && !captchaToken)}
          onClick={resendConfirmation}
        >
          {resending ? "Sending..." : "Resend confirmation email"}
        </Button>
        <Link href="/auth/sign-in" className="inline-block text-sm text-storm-electric underline">
          Return to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
