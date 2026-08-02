"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmailVerificationNotice } from "@/components/auth/sign-up-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PENDING_EMAIL_KEY = "stormhub_pending_verification_email";

export default function CheckEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEmail(window.sessionStorage.getItem(PENDING_EMAIL_KEY));
    setReady(true);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      {!ready ? (
        <p className="text-sm text-muted-foreground" role="status">Loading verification status…</p>
      ) : email ? (
        <EmailVerificationNotice email={email} />
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Open your verification email</CardTitle>
            <CardDescription>Your confirmation link finishes creating your StormHub account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>If you have not registered yet, return to signup to request a verification email.</p>
            <Link href="/auth/sign-up" className="text-storm-electric underline underline-offset-2">
              Return to signup
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
