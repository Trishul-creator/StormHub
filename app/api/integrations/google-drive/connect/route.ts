import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
} from "@/lib/google-drive";
import { getGoogleDriveServerConfig } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (
    !auth.userId
    || !auth.profile
    || auth.isDemo
    || (auth.profile.account_status && auth.profile.account_status !== "active")
  ) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  if (!getGoogleDriveServerConfig()) {
    return NextResponse.redirect(new URL("/settings?google_drive=not_configured", request.url));
  }

  const requestUrl = new URL(request.url);
  const nonce = randomBytes(24).toString("base64url");
  const state = createGoogleOAuthState({
    userId: auth.userId,
    nonce,
    returnTo: requestUrl.searchParams.get("returnTo"),
  });
  const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state));
  response.cookies.set("stormhub_google_drive_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google-drive",
    maxAge: 10 * 60,
  });
  return response;
}
