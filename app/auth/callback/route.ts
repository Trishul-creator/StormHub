import { createClient } from "@/lib/supabase/server";
import { createProfileIfMissing, defaultPathForProfile } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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
        const destination = next === "/dashboard" ? defaultPathForProfile(profile) : next;
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in`);
}
