import type { MetadataRoute } from "next";
import { getSettings } from "../lib/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { appUrl } = await getSettings();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/superadmin", "/profile", "/checkout", "/messages", "/wallet", "/api/", "/app-session", "/club-start"] }],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
