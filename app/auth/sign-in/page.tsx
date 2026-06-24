"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoSignIn, supabaseSignIn } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isDemo = !isSupabaseConfigured();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const result = isDemo
      ? await demoSignIn(email, password)
      : await supabaseSignIn(email, password);

    setLoading(false);
    if (result.success) {
      toast({ title: "Welcome back!", description: "You're signed in to StormHub." });
      const params = new URLSearchParams(window.location.search);
      router.push(params.get("redirect") || "/dashboard");
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
          <CardDescription>
            {isDemo ? "Demo mode — any email/password works" : "Use your school email to sign in"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-storm-electric hover:underline">Sign up</Link>
          </p>
          {isDemo && (
            <p className="mt-3 text-center text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              Configure Supabase in .env.local for real authentication
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
