import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { maybeGetSupabaseAnonKey, maybeGetSupabaseUrl } from "@/lib/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Health probes are intentionally public and do not need a Supabase session
  // refresh. Skipping Auth avoids turning every uptime check into an additional
  // remote authentication request.
  if (request.nextUrl.pathname === "/api/health") {
    return supabaseResponse;
  }

  const url = maybeGetSupabaseUrl();
  const key = maybeGetSupabaseAnonKey();

  if (!url || !key || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
