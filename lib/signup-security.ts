import { createHmac } from "node:crypto";

export interface SignupBotProof {
  website?: string;
  loadedAt?: number;
  captchaToken?: string | null;
}

export function isMissingAllowedEmailDomainsColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return code === "42703"
    || (message.includes("allowed_email_domains") && message.includes("does not exist"));
}

export function getAllowedSignupDomains(
  schoolDomains: unknown,
  environmentDomains?: string
): string[] {
  const configuredDomains = Array.isArray(schoolDomains)
    ? schoolDomains.filter((domain): domain is string => typeof domain === "string")
    : [];

  return [...configuredDomains, ...(environmentDomains ?? "").split(",")]
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean)
    .filter((domain, index, domains) => domains.indexOf(domain) === index);
}

export function validateSignupEmailDomain(
  email: string,
  allowedDomains: string[],
  blockedEnvironmentDomains?: string
): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  const emailDomain = normalizedEmail.split("@")[1];
  const blockedDomains = (blockedEnvironmentDomains ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  if (allowedDomains.length === 0) {
    return "Signups are not configured for this school yet. Contact the school administrator.";
  }
  if (
    !allowedDomains.includes("*")
    && (!emailDomain || !allowedDomains.includes(emailDomain))
  ) {
    return `Please use an approved school email address (${allowedDomains.join(", ")}).`;
  }
  if (emailDomain && blockedDomains.includes(emailDomain)) {
    return "Please use a school email address.";
  }
  return null;
}

export function parseSignupDomainInput(input: string): {
  domains: string[];
  invalidDomains: string[];
} {
  const candidates = input
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  const domains = candidates
    .filter((domain) => domain === "*" || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
    .filter((domain, index, values) => values.indexOf(domain) === index);
  const invalidDomains = candidates.filter((domain) => !domains.includes(domain));
  return { domains, invalidDomains };
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
