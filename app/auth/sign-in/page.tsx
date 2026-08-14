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
import { PasswordInput } from "@/components/auth/password-input";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import { useLanguage } from "@/components/i18n/language-provider";

export default function SignInPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("password_updated") === "1") {
      toast({
        title: t("auth.passwordUpdated"),
        description: t("auth.passwordUpdatedDescription"),
      });
    } else if (params.get("error") === "invalid_or_expired_link") {
      toast({
        title: t("auth.linkUnavailable"),
        description: t("auth.linkUnavailableDescription"),
        variant: "destructive",
      });
    } else if (params.get("error") === "google_sign_in_failed") {
      toast({
        title: t("auth.googleFailed"),
        description: t("auth.googleFailedDescription"),
        variant: "destructive",
      });
    }
  }, [t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (captchaRequired && !captchaToken) {
      setLoading(false);
      toast({
        title: t("auth.captchaRequired"),
        description: t("auth.captchaRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    const result = await demoSignIn(email, password, captchaToken);

    setLoading(false);
    if (result.success) {
      toast({ title: t("auth.welcomeBack"), description: t("auth.signedIn") });
      const params = new URLSearchParams(window.location.search);
      const redirectTo = "redirectTo" in result && typeof result.redirectTo === "string" ? result.redirectTo : undefined;
      router.push(safeAuthRedirectPath(params.get("redirect"), redirectTo || "/dashboard"));
      router.refresh();
    } else {
      setCaptchaToken(null);
      setCaptchaAttempt((attempt) => attempt + 1);
      toast({
        title: result.errorTitle || t("auth.couldNotSignIn"),
        description: result.error,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-storm-subtle">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <CardTitle>{t("auth.signInTitle")}</CardTitle>
          <CardDescription>{t("auth.signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {googleAuthEnabled && (
            <>
              <GoogleAuthButton />
              <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>{t("auth.orPassword")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                name="password"
                required
                autoComplete="current-password"
                className="mt-1"
              />
              <div className="mt-2 text-right">
                <Link href="/auth/forgot-password" className="text-sm text-storm-electric underline underline-offset-2">
                  {t("auth.forgotPassword")}
                </Link>
              </div>
            </div>
            <Captcha key={captchaAttempt} onToken={setCaptchaToken} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : t("common.signIn")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/auth/sign-up" className="text-storm-electric underline">{t("auth.signUp")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
