import "server-only";

import { maybeGetSupabaseAnonKey, maybeGetSupabaseUrl } from "@/lib/env";

export type EmailConfirmationStatus = "required" | "disabled" | "unavailable";

export async function getEmailConfirmationStatus(
  env: Record<string, string | undefined> = process.env
): Promise<EmailConfirmationStatus> {
  const url = maybeGetSupabaseUrl(env);
  const anonKey = maybeGetSupabaseAnonKey(env);
  if (!url || !anonKey) return "unavailable";

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return "unavailable";

    const settings = await response.json() as {
      mailer_autoconfirm?: boolean;
      external?: { email?: boolean };
    };
    if (settings.external?.email === false) return "disabled";
    return settings.mailer_autoconfirm === false ? "required" : "disabled";
  } catch {
    return "unavailable";
  }
}
