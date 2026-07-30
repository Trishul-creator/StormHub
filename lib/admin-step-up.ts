import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_REAUTHENTICATION_MAX_AGE_SECONDS,
  adminReauthenticationPath,
  adminReauthenticationFailure,
  type AdminReauthenticationFailure,
} from "@/lib/admin-step-up-shared";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

type AuthenticationMethodReference = {
  method?: unknown;
  timestamp?: unknown;
};

type AccessTokenClaims = {
  sub?: unknown;
  amr?: unknown;
};

function decodeAccessTokenClaims(accessToken: string): AccessTokenClaims | null {
  const encodedPayload = accessToken.split(".")[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export async function hasRecentAdminAuthentication(
  client?: SupabaseServerClient | null,
  expectedUserId?: string | null
): Promise<boolean> {
  const supabase = client ?? await createClient();
  if (!supabase) return false;

  // getUser verifies the session with Supabase Auth before any decoded JWT
  // claim is trusted. getSession then supplies the signed token containing AMR.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (
    userError
    || sessionError
    || !user
    || !session?.access_token
    || (expectedUserId && user.id !== expectedUserId)
  ) {
    return false;
  }

  const claims = decodeAccessTokenClaims(session.access_token);
  if (!claims || claims.sub !== user.id || !Array.isArray(claims.amr)) return false;

  const now = Math.floor(Date.now() / 1000);
  const acceptedMethods = new Set(["password", "oauth", "totp", "sso/saml"]);
  return (claims.amr as AuthenticationMethodReference[]).some((entry) => {
    const timestamp = typeof entry.timestamp === "number"
      ? entry.timestamp
      : Number(entry.timestamp);
    return typeof entry.method === "string"
      && acceptedMethods.has(entry.method)
      && Number.isFinite(timestamp)
      && timestamp <= now + 30
      && now - timestamp <= ADMIN_REAUTHENTICATION_MAX_AGE_SECONDS;
  });
}

export async function requireRecentAdminAuthentication(
  client?: SupabaseServerClient | null,
  expectedUserId?: string | null
): Promise<AdminReauthenticationFailure | null> {
  return await hasRecentAdminAuthentication(client, expectedUserId)
    ? null
    : adminReauthenticationFailure();
}

export async function requireRecentAdminAuthenticationOrRedirect(
  next: string,
  client?: SupabaseServerClient | null,
  expectedUserId?: string | null
): Promise<void> {
  if (!await hasRecentAdminAuthentication(client, expectedUserId)) {
    redirect(adminReauthenticationPath(next));
  }
}
