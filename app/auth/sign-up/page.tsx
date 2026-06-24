"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoSignIn, supabaseSignUp } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isDemo = !isSupabaseConfigured();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const fullName = form.get("fullName") as string;

    if (isDemo) {
      const { demoSignIn: signIn } = await import("@/lib/actions");
      const result = await signIn(email, password);
      setLoading(false);
      if (result.success) {
        toast({ title: "Welcome to StormHub!", description: "Your account has been created." });
        router.push("/dashboard");
        router.refresh();
      } else {
        toast({ title: "Sign up failed", description: result.error, variant: "destructive" });
      }
      return;
    }

    const result = await supabaseSignUp(email, password, fullName);
    setLoading(false);
    if (result.success) {
      if (result.needsConfirmation) {
        toast({ title: "Check your email", description: "Confirm your email address to complete signup." });
      } else {
        toast({ title: "Welcome to StormHub!", description: "Your account has been created." });
        router.push("/dashboard");
        router.refresh();
      }
      if (result.needsConfirmation) router.push("/auth/sign-in");
    } else {
      toast({ title: "Sign up failed", description: result.error, variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-storm-subtle">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <CardTitle>Join StormHub</CardTitle>
          <CardDescription>Create your account to join clubs and track opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required placeholder="Your name" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/sign-in" className="text-storm-electric hover:underline">Sign in</Link>
          </p>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            {/* TODO: Restrict signups to school email domain in Supabase Auth settings */}
            In production, signups can be restricted to @elkhornsouth.org emails via Supabase Auth settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
