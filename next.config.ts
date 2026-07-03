import type { NextConfig } from "next";

const shouldUseStagingPublicSupabase =
  process.env.E2E_ENVIRONMENT === "staging" || process.env.VERCEL_ENV === "preview";

const publicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (shouldUseStagingPublicSupabase
    ? process.env.STAGING_NEXT_PUBLIC_SUPABASE_URL ?? process.env.STAGING_SUPABASE_URL
    : undefined);

const publicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (shouldUseStagingPublicSupabase
    ? process.env.STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.STAGING_SUPABASE_ANON_KEY
    : undefined);

const nextConfig: NextConfig = {
  env: {
    ...(publicSupabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl } : {}),
    ...(publicSupabaseAnonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKey } : {}),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
