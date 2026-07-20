import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/env";
import { SUPPORT_EMAIL } from "@/lib/schools";

export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return new NextResponse([
    `Contact: mailto:${SUPPORT_EMAIL}`,
    `Expires: ${expires}`,
    `Canonical: ${getPublicSiteUrl()}/.well-known/security.txt`,
    "Preferred-Languages: en",
  ].join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
