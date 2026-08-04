"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Captcha } from "@/components/auth/captcha";
import { PasswordInput } from "@/components/auth/password-input";
import { friendlySignInError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

export function AdminReauthenticationDialog({
  open,
  onOpenChange,
  email,
  onVerified,
  returnTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onVerified: () => void | Promise<void>;
  returnTo?: string;
}) {
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim());

  useEffect(() => {
    if (!open) {
      setPassword("");
      setCaptchaToken(null);
      setCaptchaAttempt((attempt) => attempt + 1);
      setError(null);
      setPending(false);
    }
  }, [open]);

  async function confirmPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError("Complete the CAPTCHA before confirming your identity.");
      return;
    }
    setPending(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (signInError || data.user?.email?.toLowerCase() !== email.toLowerCase()) {
      setPending(false);
      setCaptchaToken(null);
      setCaptchaAttempt((attempt) => attempt + 1);
      setError(
        signInError
          ? friendlySignInError(signInError).message
          : "That password did not confirm this administrator account."
      );
      return;
    }
    setPassword("");
    await onVerified();
    setPending(false);
    onOpenChange(false);
  }

  async function confirmWithGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }
    setPending(true);
    setError(null);
    const next = returnTo || `${window.location.pathname}${window.location.search}`;
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        scopes: "openid email profile",
        queryParams: {
          prompt: "select_account",
          login_hint: email,
        },
      },
    });
    if (oauthError) {
      setPending(false);
      setError(oauthError.message || "Google could not confirm this administrator account.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 text-card-foreground shadow-2xl">
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close identity confirmation"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-storm-electric/10 text-storm-electric">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <Dialog.Title className="text-xl font-semibold text-storm-navy">
            Confirm your identity
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            This sensitive administrative action requires a recent sign-in. Confirmation remains
            valid for five minutes.
          </Dialog.Description>

          <form onSubmit={confirmPassword} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="admin-confirm-password">Password for {email}</Label>
              <PasswordInput
                id="admin-confirm-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={pending}
                className="mt-1"
              />
            </div>
            <Captcha key={captchaAttempt} onToken={setCaptchaToken} />
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !password || (captchaRequired && !captchaToken)}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Confirm with password
            </Button>
          </form>

          {googleAuthEnabled && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={confirmWithGoogle}
              >
                <GoogleMark />
                Confirm with Google
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Google returns you to this page. Repeat the administrative action after confirmation.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
