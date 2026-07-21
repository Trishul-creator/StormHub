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

const isProduction = process.env.NODE_ENV === "production";
const supabaseOrigin = publicSupabaseUrl ? new URL(publicSupabaseUrl).origin : "";
const supabaseWebsocketOrigin = supabaseOrigin.replace(/^http/, "ws");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://js.hcaptcha.com https://*.hcaptcha.com`,
  "style-src 'self' 'unsafe-inline' https://*.hcaptcha.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.hcaptcha.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWebsocketOrigin} https://*.hcaptcha.com`.replace(/\s+/g, " ").trim(),
  "frame-src https://*.hcaptcha.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
