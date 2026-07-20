import { createHmac } from "node:crypto";

export interface SignupBotProof {
  website?: string;
  loadedAt?: number;
  captchaToken?: string | null;
}

export function validateSignupBotProof(
  proof: SignupBotProof | undefined,
  now = Date.now()
): string | null {
  if (!proof || proof.website?.trim()) return "Please reload the signup page and try again.";
  const loadedAt = Number(proof.loadedAt);
  if (!Number.isFinite(loadedAt) || loadedAt <= 0 || loadedAt > now || now - loadedAt < 1500) {
    return "Please reload the signup page and try again.";
  }
  return null;
}

export function getClientAddress(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || null;
}

export function hashSignupIdentifier(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

export function getSignupRateLimitConfig(env: Record<string, string | undefined> = process.env) {
  return {
    windowMinutes: positiveInteger(env.SIGNUP_RATE_LIMIT_WINDOW_MINUTES, 60),
    maxEmailAttempts: positiveInteger(env.SIGNUP_MAX_ATTEMPTS_PER_EMAIL, 5),
    maxIpAttempts: positiveInteger(env.SIGNUP_MAX_ATTEMPTS_PER_IP, 50),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
