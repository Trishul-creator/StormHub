"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Captcha } from "@/components/auth/captcha";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      toast({
        title: "Password reset unavailable",
        description: "Authentication is not configured for this deployment.",
        variant: "destructive",
      });
      return;
    }

    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/auth/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callback.toString(),
      ...(captchaToken ? { captchaToken } : {}),
    });
    setLoading(false);

    if (error) {
      const captchaFailed = error.message.toLowerCase().includes("captcha");
      toast({
        title: "Could not send reset email",
        description: captchaFailed
          ? "Complete the security verification and try again."
          : "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    setSentTo(email);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
            {sentTo ? <MailCheck className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
          </div>
          <CardTitle>{sentTo ? "Check your email" : "Reset your password"}</CardTitle>
          <CardDescription>
            {sentTo
              ? "If a StormHub account exists for that address, a secure reset link is on its way."
              : "Enter the email address connected to your StormHub account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <div className="space-y-4 text-center">
              <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-foreground">{sentTo}</p>
              <p className="text-sm text-muted-foreground">
                The link expires for security. Check your spam folder if it does not arrive after a few minutes.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
                Try another email
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@school.edu"
                  className="mt-1"
                />
              </div>
              <Captcha onToken={setCaptchaToken} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending reset link..." : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm">
            <Link href="/auth/sign-in" className="inline-flex items-center gap-1 text-storm-electric underline underline-offset-2">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
