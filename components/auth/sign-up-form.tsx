"use client";

import { useEffect, useState } from "react";
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
import { PasswordInput } from "@/components/auth/password-input";
import { createClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { HIGH_SCHOOL_AGE_ASSURANCE } from "@/lib/policy";
import { useLanguage } from "@/components/i18n/language-provider";
import { translateInterfaceText } from "@/lib/i18n/interface-phrases";

interface SignUpSchool {
  id: string;
  name: string;
  short_name?: string | null;
  slug: string;
}

export function SignUpForm({
  schools,
  preselectedSchoolId,
  googleAuthEnabled = false,
}: {
  schools: SignUpSchool[];
  preselectedSchoolId?: string | null;
  googleAuthEnabled?: boolean;
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadedAt] = useState(() => Date.now());
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirmPassword") as string;
    const fullName = form.get("fullName") as string;
    const gradeLevelRaw = String(form.get("gradeLevel") ?? "");
    const accessCode = String(form.get("accessCode") ?? "");
    const schoolId = String(form.get("schoolId") ?? "");
    const website = String(form.get("website") ?? "");
    const formLoadedAt = Number(form.get("loadedAt") ?? 0);
    const acceptedPolicies = form.get("policyAccepted") === "on";
    const ageAssurance = form.get("ageAssurance") === "on"
      ? HIGH_SCHOOL_AGE_ASSURANCE
      : undefined;

    if (website || !formLoadedAt || Date.now() - formLoadedAt < 1500) {
      setLoading(false);
      toast({ title: t("signup.failed"), description: t("auth.tryAgain"), variant: "destructive" });
      return;
    }
    if (fullName.trim().length < 3) {
      setLoading(false);
      toast({ title: t("signup.failed"), description: t("signup.enterFullName"), variant: "destructive" });
      return;
    }
    if (!schoolId) {
      setLoading(false);
      toast({ title: t("signup.failed"), description: t("signup.chooseSchoolError"), variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      setLoading(false);
      toast({ title: t("signup.failed"), description: t("signup.passwordMismatch"), variant: "destructive" });
      return;
    }
    const result = await supabaseSignUp(
      email,
      password,
      confirmPassword,
      fullName,
      gradeLevelRaw ? Number(gradeLevelRaw) : null,
      accessCode,
      schoolId,
      {
        website,
        loadedAt: formLoadedAt,
        captchaToken,
        acceptedPolicies,
        ageAssurance,
      }
    );
    setLoading(false);
    if (result.success) {
      if (result.needsConfirmation) {
        const normalizedPendingEmail = email.trim().toLowerCase();
        window.sessionStorage.setItem("stormhub_pending_verification_email", normalizedPendingEmail);
        toast({ title: t("signup.checkEmail"), description: t("signup.confirmAddress") });
        setPendingEmail(normalizedPendingEmail);
        router.push("/auth/check-email");
      } else {
        toast({ title: t("signup.welcome"), description: t("signup.created") });
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      // hCaptcha response tokens are single-use. Render a fresh challenge after
      // any server-side rejection so a retry cannot reuse the consumed token.
      setCaptchaToken(null);
      setCaptchaAttempt((attempt) => attempt + 1);
      toast({ title: t("signup.failed"), description: result.error, variant: "destructive" });
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
        <CardTitle>{t("signup.title")}</CardTitle>
        <CardDescription>{t("signup.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {googleAuthEnabled && (
          <>
            <GoogleAuthButton />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("signup.googleSchoolNote")}
            </p>
            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>{t("signup.orPassword")}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="schoolId">{t("signup.school")}</Label>
            <select
              id="schoolId"
              name="schoolId"
              required
              defaultValue={preselectedSchoolId ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("signup.chooseSchool")}</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fullName">{t("signup.fullName")}</Label>
            <Input id="fullName" name="fullName" required placeholder={t("signup.yourName")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" required placeholder="you@school.edu" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="gradeLevel">{t("signup.grade")}</Label>
            <select
              id="gradeLevel"
              name="gradeLevel"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
            >
              <option value="">{t("signup.notApplicable")}</option>
              {[9, 10, 11, 12].map((grade) => (
                <option key={grade} value={grade}>
                  {t("signup.gradeValue", { grade })}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("signup.gradeHelp")}
            </p>
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("signup.passwordHelp")}</p>
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t("signup.confirmPassword")}</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={12}
              autoComplete="new-password"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="accessCode">{t("signup.accessCode")}</Label>
            <Input
              id="accessCode"
              name="accessCode"
              required
              autoComplete="one-time-code"
              className="mt-1 font-mono uppercase"
              placeholder="SH-1234-ABCD-5678"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("signup.accessCodeHelp")}
            </p>
          </div>
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="website">{t("signup.website")}</Label>
            <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <input type="hidden" name="loadedAt" value={loadedAt} />
          <Captcha key={captchaAttempt} onToken={setCaptchaToken} />
          <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <input name="ageAssurance" type="checkbox" required className="mt-1 h-4 w-4 rounded border-input" />
            <span>
              {t("signup.ageAssurance")}
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <input name="policyAccepted" type="checkbox" required className="mt-1 h-4 w-4 rounded border-input" />
            <span>
              {t("signup.policyPrefix")}{" "}
              <Link href="/acceptable-use" className="text-storm-electric hover:underline">{t("signup.acceptableUse")}</Link>,{" "}
              <Link href="/terms" className="text-storm-electric hover:underline">{t("footer.terms")}</Link>, {translateInterfaceText("and", locale)}{" "}
              <Link href="/privacy" className="text-storm-electric hover:underline">{t("signup.privacyNotice")}</Link>.
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("signup.creating") : t("signup.create")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("signup.haveAccount")}{" "}
          <Link href="/auth/sign-in" className="text-storm-electric underline">{t("common.signIn")}</Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("signup.confirmationNote")}
        </p>
      </CardContent>
    </Card>
  );
}

export function EmailVerificationNotice({ email }: { email: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim());

  useEffect(() => {
    const supabaseClient = createClient();
    if (!supabaseClient) return;
    const auth = supabaseClient.auth;
    let active = true;

    async function checkConfirmation() {
      const { data } = await auth.getUser();
      if (!active || !data.user) return;
      setConfirmed(true);
      window.sessionStorage.removeItem("stormhub_pending_verification_email");
      router.replace("/dashboard");
      router.refresh();
    }

    void checkConfirmation();
    const interval = window.setInterval(() => void checkConfirmation(), 3_000);
    const onFocus = () => void checkConfirmation();
    window.addEventListener("focus", onFocus);
    const { data: authListener } = auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void checkConfirmation();
    });

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  async function resendConfirmation() {
    setResending(true);
    const result = await supabaseResendConfirmation(email, captchaToken);
    setResending(false);
    toast(
      result.success
        ? { title: t("verification.sent"), description: t("verification.sentDescription") }
        : { title: t("verification.failed"), description: result.error, variant: "destructive" }
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-storm-gradient">
          <MailCheck className="h-5 w-5 text-white" />
        </div>
        <CardTitle>{t("signup.checkEmail")}</CardTitle>
        <CardDescription>
          {t("verification.sentPrefix")} <span>{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("verification.instructions")}
        </p>
        <div className="flex items-center justify-center gap-2 rounded-lg bg-storm-light/40 px-3 py-2 text-xs text-muted-foreground" role="status">
          <span className={`h-2 w-2 rounded-full ${confirmed ? "bg-emerald-500" : "animate-pulse bg-storm-electric"}`} />
          {confirmed ? t("verification.confirmed") : t("verification.waiting")}
        </div>
        <Captcha onToken={setCaptchaToken} />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={resending || (captchaRequired && !captchaToken)}
          onClick={resendConfirmation}
        >
          {resending ? t("verification.sending") : t("verification.resend")}
        </Button>
        <Link href="/auth/sign-in" className="inline-block text-sm text-storm-electric underline">
          {t("verification.return")}
        </Link>
      </CardContent>
    </Card>
  );
}
