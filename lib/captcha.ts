import "server-only";

import { getHcaptchaSecret } from "@/lib/env";

type CaptchaResult = { success: true } | { success: false; error: string };

export async function verifyCaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<CaptchaResult> {
  const secret = getHcaptchaSecret();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return { success: true };
    return { success: false, error: "Security verification is not configured." };
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
