import "server-only";

import { getHcaptchaSecret } from "@/lib/env";

type CaptchaResult = { success: true } | { success: false; error: string };

export async function verifyCaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<CaptchaResult> {
  const secret = getHcaptchaSecret();
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  if (!secret && !siteKey) {
    // Public support remains protected by durable IP/sender rate limits when
    // CAPTCHA is intentionally disabled.
    return { success: true };
  }
  if (!secret || !siteKey) {
    return { success: false, error: "Security verification configuration is incomplete." };
  }
  if (!token) return { success: false, error: "Complete the security check." };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
    const result = await response.json() as { success?: boolean };
    return result.success
      ? { success: true }
      : { success: false, error: "Security verification failed. Please try again." };
  } catch {
    return { success: false, error: "Security verification is temporarily unavailable." };
  }
}
