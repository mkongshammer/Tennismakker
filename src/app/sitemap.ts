import type { MetadataRoute } from "next";
import { db } from "../lib/db";
import { getSettings } from "../lib/settings";
import { SPORTS } from "../lib/sports";

export const dynamic = "force-dynamic";

/** Public pages only: approved US clubs, US coaches, discovery per sport, marketing and legal pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { appUrl } = await getSettings();
  const [clubs, coaches] = await Promise.all([
    db.club.findMany({ where: { status: "APPROVED", country: "US" }, select: { slug: true, createdAt: true } }),
    db.coachProfile.findMany({ where: { country: "US" }, select: { id: true } }),
  ]);
  const now = new Date();
  return [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/courts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...SPORTS.filter((s) => s !== "TENNIS").map((sport) => ({ url: `${appUrl}/courts?sport=${sport}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${appUrl}/coaches`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${appUrl}/players`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${appUrl}/list-your-club`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/terms/us`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...clubs.map((c) => ({ url: `${appUrl}/clubs/${c.slug}`, lastModified: c.createdAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...coaches.map((c) => ({ url: `${appUrl}/coaches/${c.id}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
