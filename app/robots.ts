import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/manage/", "/settings", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
