"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoSignIn } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";
import { Captcha } from "@/components/auth/captcha";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "google_sign_in_failed") {
      toast({
        title: "Google sign-in failed",
        description: "Google could not finish signing you in. Please try again.",
        variant: "destructive",
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const result = await demoSignIn(email, password, captchaToken);

    setLoading(false);
    if (result.success) {
      toast({ title: "Welcome back!", description: "You're signed in to StormHub." });
      const params = new URLSearchParams(window.location.search);
      const redirectTo = "redirectTo" in result && typeof result.redirectTo === "string" ? result.redirectTo : undefined;
      router.push(params.get("redirect") || redirectTo || "/dashboard");
      router.refresh();
    } else {
      toast({ title: "Sign in failed", description: result.error, variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-storm-subtle">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <CardTitle>Sign in to StormHub</CardTitle>
          <CardDescription>Use your school email to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          {googleAuthEnabled && (
            <>
              <GoogleAuthButton />
              <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or use your password</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required className="mt-1" />
            </div>
            <Captcha onToken={setCaptchaToken} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-storm-electric underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
