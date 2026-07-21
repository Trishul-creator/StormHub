"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { KeyRound, Loader2, MessageSquareText, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = { id: string; status: string; friendly_name?: string };
type MfaMethod = "phone" | "totp";
type QrCodeImage = { src: string; width: number; height: number };

const SVG_DATA_URL_PREFIX = "data:image/svg+xml;utf-8,";
const SMS_RESEND_COOLDOWN_SECONDS = 60;

function configuredEnrollmentMethod(): MfaMethod {
  return process.env.NEXT_PUBLIC_ADMIN_MFA_METHOD === "totp" ? "totp" : "phone";
}

function normalizePhoneNumber(value: string) {
  const normalized = value.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function maskPhoneNumber(value: string) {
  const lastFour = value.replace(/\D/g, "").slice(-4);
  return lastFour.length === 4 ? `ending in ${lastFour}` : "your enrolled phone";
}

function normalizeQrCode(qrCode: string): QrCodeImage {
  const trimmed = qrCode.trim();
  if (!trimmed.startsWith(SVG_DATA_URL_PREFIX)) {
    return { src: trimmed, width: 219, height: 219 };
  }

  const svg = trimmed.slice(SVG_DATA_URL_PREFIX.length).trim();
  const width = Number(svg.match(/\bwidth=["']?(\d+)/i)?.[1]) || 219;
  const height = Number(svg.match(/\bheight=["']?(\d+)/i)?.[1]) || width;
  return {
    src: svg.startsWith("<")
      ? `${SVG_DATA_URL_PREFIX}${encodeURIComponent(svg)}`
      : trimmed,
    width: Math.min(Math.max(width, 128), 320),
    height: Math.min(Math.max(height, 128), 320),
  };
}

function normalizeAuthenticatorUri(uri: string) {
  try {
    const normalized = uri.trim();
    return new URL(normalized).protocol === "otpauth:" ? normalized : null;
  } catch {
    return null;
  }
}

export function MfaSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")!
    : "/manage";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<MfaMethod>(configuredEnrollmentMethod);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneLabel, setPhoneLabel] = useState("your enrolled phone");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [qrCode, setQrCode] = useState<QrCodeImage | null>(null);
  const [authenticatorUri, setAuthenticatorUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        if (active) {
          setError("Authentication is not configured.");
          setLoading(false);
        }
        return;
      }
      const [{ data: assurance }, { data: factors, error: factorsError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (!active) return;
      if (assurance?.currentLevel === "aal2") {
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      if (factorsError) {
        setError(factorsError.message);
      } else {
        const verifiedPhone = (factors?.phone ?? []).find(
          (factor: Factor) => factor.status === "verified"
        );
        const verifiedTotp = (factors?.totp ?? []).find(
          (factor: Factor) => factor.status === "verified"
        );
        const verified = verifiedPhone ?? verifiedTotp;
        if (verified) {
          setFactorId(verified.id);
          setMethod(verifiedPhone ? "phone" : "totp");
          if (verifiedPhone?.friendly_name) setPhoneLabel(verifiedPhone.friendly_name);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [redirectTo, router]);

  async function beginEnrollment() {
    const supabase = createClient();
    if (!supabase) return;
    const enrollmentMethod = configuredEnrollmentMethod();
    const normalizedPhone = enrollmentMethod === "phone" ? normalizePhoneNumber(phoneNumber) : null;
    if (enrollmentMethod === "phone" && !normalizedPhone) {
      setError("Enter a complete phone number with country code, such as +1 312 555 0198.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const staleFactors = (enrollmentMethod === "phone" ? factors?.phone ?? [] : factors?.totp ?? [])
        .filter((factor: Factor) => factor.status !== "verified");
      for (const factor of staleFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError) {
          setError("A previous verification setup could not be reset. Refresh the page and try again.");
          return;
        }
      }

      if (enrollmentMethod === "phone" && normalizedPhone) {
        const label = maskPhoneNumber(normalizedPhone);
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "phone",
          phone: normalizedPhone,
          friendlyName: label,
        });
        if (enrollError) {
          setError("Text-message verification is not available. Contact support if this continues.");
          return;
        }
        setFactorId(data.id);
        setMethod("phone");
        setPhoneLabel(label);
        setPhoneNumber("");

        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: data.id,
          channel: "sms",
        });
        if (challengeError) {
          setError("The verification text could not be sent. Wait a minute and try again.");
          return;
        }
        setChallengeId(challenge.id);
        setResendCooldown(SMS_RESEND_COOLDOWN_SECONDS);
        return;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "StormHub administrator",
        issuer: "StormHub",
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setFactorId(data.id);
      setMethod("totp");
      setQrCode(normalizeQrCode(data.totp.qr_code));
      setAuthenticatorUri(normalizeAuthenticatorUri(data.totp.uri));
      setSecret(data.totp.secret);
    } catch {
      setError("Verification setup is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPhoneCode() {
    const supabase = createClient();
    if (!supabase || !factorId || method !== "phone" || resendCooldown > 0) return;
    setSubmitting(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
      channel: "sms",
    });
    setSubmitting(false);
    if (challengeError) {
      setError("The verification text could not be sent. Wait a minute and try again.");
      return;
    }
    setChallengeId(challenge.id);
    setCode("");
    setResendCooldown(SMS_RESEND_COOLDOWN_SECONDS);
  }

  async function verify() {
    const supabase = createClient();
    if (!supabase || !factorId || code.trim().length !== 6) return;
    setSubmitting(true);
    setError(null);

    let verificationChallengeId = challengeId;
    if (method === "totp") {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        setSubmitting(false);
        setError(challengeError.message);
        return;
      }
      verificationChallengeId = challenge.id;
    }
    if (!verificationChallengeId) {
      setSubmitting(false);
      setError("Send a verification code before continuing.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: verificationChallengeId,
      code: code.trim(),
    });
    setSubmitting(false);
    if (verifyError) {
      setError("That code was not accepted. Check the code and try again.");
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  if (loading) {
    return <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const showPhoneEnrollment = !factorId && method === "phone";
  const showPhoneChallenge = factorId && method === "phone" && !challengeId;
  const showCodeEntry = factorId && (method === "totp" || Boolean(challengeId));

  return (
    <div className="space-y-5">
      {showPhoneEnrollment && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="mfa-phone">Mobile phone number</Label>
            <Input
              id="mfa-phone"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 312 555 0198"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Include the country code. This number is used only for administrator sign-in verification.
            </p>
          </div>
          <Button onClick={beginEnrollment} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            Send verification code
          </Button>
        </div>
      )}

      {!factorId && method === "totp" && (
        <Button onClick={beginEnrollment} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Set up authenticator
        </Button>
      )}

      {qrCode && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            Scan this inside an authenticator app. A regular camera or browser cannot open an authenticator link.
          </p>
          <Image
            src={qrCode.src}
            alt="Authenticator setup QR code"
            width={qrCode.width}
            height={qrCode.height}
            unoptimized
            className="mx-auto h-auto max-w-full"
          />
          {authenticatorUri && (
            <Button asChild type="button" variant="outline" className="w-full">
              <a href={authenticatorUri}>
                <Smartphone className="h-4 w-4" />
                Open authenticator app
              </a>
            </Button>
          )}
          {secret && <p className="break-all font-mono text-xs text-muted-foreground">Manual key: {secret}</p>}
        </div>
      )}

      {showPhoneChallenge && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Send a sign-in code to {phoneLabel}.</p>
          <Button onClick={sendPhoneCode} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            Send text message
          </Button>
        </div>
      )}

      {showCodeEntry && (
        <div className="space-y-3">
          {method === "phone" && (
            <p className="text-sm text-muted-foreground">A six-digit code was sent to {phoneLabel}.</p>
          )}
          <div>
            <Label htmlFor="mfa-code">Six-digit code</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-1 text-center text-lg"
            />
          </div>
          <Button onClick={verify} disabled={submitting || code.length !== 6} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify and continue
          </Button>
          {method === "phone" && (
            <Button
              type="button"
              variant="outline"
              onClick={sendPhoneCode}
              disabled={submitting || resendCooldown > 0}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4" />
              {resendCooldown > 0 ? `Send another code in ${resendCooldown}s` : "Send another code"}
            </Button>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
