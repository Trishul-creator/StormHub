import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  exchangeGoogleAuthorizationCode,
  saveGoogleDriveConnection,
  verifyGoogleOAuthState,
} from "@/lib/google-drive";

export const runtime = "nodejs";

function redirectWithStatus(
  request: Request,
  returnTo: string,
  status: "connected" | "denied" | "error"
) {
  const url = new URL(returnTo, request.url);
  url.searchParams.set("google_drive", status);
  const response = NextResponse.redirect(url);
  response.cookies.set("stormhub_google_drive_nonce", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google-drive",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = verifyGoogleOAuthState(requestUrl.searchParams.get("state") ?? "");
  if (!state) return redirectWithStatus(request, "/settings", "error");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const nonce = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("stormhub_google_drive_nonce="))
    ?.slice("stormhub_google_drive_nonce=".length);
  const auth = await getAuthContext();
  if (
    !nonce
    || nonce !== state.nonce
    || !auth.userId
    || auth.userId !== state.userId
    || (auth.profile?.account_status && auth.profile.account_status !== "active")
  ) {
    return redirectWithStatus(request, "/settings", "error");
  }
  if (requestUrl.searchParams.get("error")) {
    return redirectWithStatus(request, state.returnTo, "denied");
  }
  const code = requestUrl.searchParams.get("code");
  if (!code) return redirectWithStatus(request, state.returnTo, "error");

  try {
    const tokens = await exchangeGoogleAuthorizationCode(code);
    await saveGoogleDriveConnection({
      userId: auth.userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      googleEmail: tokens.googleEmail,
    });
    return redirectWithStatus(request, state.returnTo, "connected");
  } catch {
    return redirectWithStatus(request, state.returnTo, "error");
  }
}
