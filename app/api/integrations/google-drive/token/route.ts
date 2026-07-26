import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  getGoogleDriveAccessToken,
  isGoogleDriveReconnectError,
} from "@/lib/google-drive";
import { isGoogleDrivePickerConfigured } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthContext();
  if (
    !auth.userId
    || !auth.profile
    || auth.isDemo
    || (auth.profile.account_status && auth.profile.account_status !== "active")
  ) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isGoogleDrivePickerConfigured()) {
    return NextResponse.json({ error: "Google Drive is not configured." }, { status: 503 });
  }
  try {
    const accessToken = await getGoogleDriveAccessToken(auth.userId);
    return NextResponse.json(
      { accessToken },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: isGoogleDriveReconnectError(error)
          ? "Connect Google Drive to continue."
          : "Could not prepare Google Drive.",
        reconnect: isGoogleDriveReconnectError(error),
      },
      { status: isGoogleDriveReconnectError(error) ? 401 : 500 }
    );
  }
}
