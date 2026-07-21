"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = { id: string; status: string; friendly_name?: string };
type QrCodeImage = { src: string; width: number; height: number };

const SVG_DATA_URL_PREFIX = "data:image/svg+xml;utf-8,";

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
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<QrCodeImage | null>(null);
  const [authenticatorUri, setAuthenticatorUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        const verified = (factors?.totp ?? []).find((factor: Factor) => factor.status === "verified");
        if (verified) setFactorId(verified.id);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [redirectTo, router]);

  async function beginEnrollment() {
    const supabase = createClient();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const staleFactors = (factors?.totp ?? []).filter(
        (factor: Factor) => factor.status !== "verified"
      );
      for (const factor of staleFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError) {
          setError("A previous authenticator setup could not be reset. Refresh the page and try again.");
          return;
        }
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
      setQrCode(normalizeQrCode(data.totp.qr_code));
      setAuthenticatorUri(normalizeAuthenticatorUri(data.totp.uri));
      setSecret(data.totp.secret);
    } catch {
      setError("Authenticator setup is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    const supabase = createClient();
    if (!supabase || !factorId || code.trim().length !== 6) return;
    setSubmitting(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setSubmitting(false);
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setSubmitting(false);
    if (verifyError) {
      setError("That code was not accepted. Wait for a new code and try again.");
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  if (loading) {
    return <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {!factorId && (
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

      {factorId && (
        <div className="space-y-3">
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
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
