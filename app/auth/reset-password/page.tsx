"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setChecking(false);
      return;
    }
    const auth = supabase.auth;

    let active = true;
    async function checkSession() {
      const { data } = await auth.getUser();
      if (!active) return;
      setAuthorized(Boolean(data.user));
      setChecking(false);
    }

    void checkSession();
    const { data: authListener } = auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setAuthorized(Boolean(session?.user));
        setChecking(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 12) {
      toast({
        title: "Password not updated",
        description: "Password must be at least 12 characters.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Password not updated",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast({
        title: "Password not updated",
        description: error.message || "Request a new reset link and try again.",
        variant: "destructive",
      });
      return;
    }

    await supabase.auth.signOut();
    router.replace("/auth/sign-in?password_updated=1");
    router.refresh();
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
            {authorized ? <KeyRound className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
          </div>
          <CardTitle>{checking ? "Checking reset link" : authorized ? "Choose a new password" : "Reset link unavailable"}</CardTitle>
          <CardDescription>
            {checking
              ? "Securely opening your password reset session."
              : authorized
                ? "Your new password must contain at least 12 characters."
                : "This link is invalid, expired, or has already been used."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-center text-sm text-muted-foreground" role="status">Please wait…</p>
          ) : authorized ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating password..." : "Update password"}
              </Button>
            </form>
          ) : (
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">Request a new reset link</Link>
            </Button>
          )}
          <p className="mt-5 text-center text-sm">
            <Link href="/auth/sign-in" className="text-storm-electric underline underline-offset-2">
              Return to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
