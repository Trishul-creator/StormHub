import { createClient } from "@/lib/supabase/server";
import { createProfileIfMissing, defaultPathForProfile } from "@/lib/auth";
import { safeAuthRedirectPath } from "@/lib/auth-redirect";
import { NextResponse } from "next/server";

function isEmailLinkError(searchParams: URLSearchParams): boolean {
  const errorCode = searchParams.get("error_code")?.toLowerCase() ?? "";
  const description = searchParams.get("error_description")?.toLowerCase() ?? "";
  return errorCode.includes("otp")
    || errorCode.includes("link")
    || description.includes("email link")
    || description.includes("one-time token")
    || description.includes("otp")
    || description.includes("expired");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        const profile = await createProfileIfMissing(
          data.user.id,
          data.user.email ?? "",
          data.user.user_metadata?.full_name as string | undefined
        );
        if (!profile || (!["district_admin", "super_admin"].includes(profile.role) && !profile.school_id)) {
          const onboarding = new URL("/auth/complete-profile", origin);
          onboarding.searchParams.set("next", next);
          return NextResponse.redirect(onboarding);
        }
        const destination = next === "/dashboard" ? defaultPathForProfile(profile) : next;
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  const signIn = new URL("/auth/sign-in", origin);
  if (searchParams.get("error")) {
    signIn.searchParams.set(
      "error",
      isEmailLinkError(searchParams) ? "invalid_or_expired_link" : "google_sign_in_failed"
    );
  } else if (code) {
    signIn.searchParams.set("error", "invalid_or_expired_link");
  }
  return NextResponse.redirect(signIn);
}
