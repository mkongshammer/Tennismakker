// Numbers for the owner's sales overview: the Instantly campaigns, club signups
// and the founding-club offer. Read-only.
import { db } from "./db";

export type CampaignNumbers = { name: string; status: string; leads: number; contacted: number; sent: number; replies: number; opportunities: number; bounced: number; unsubscribed: number };

const STATUS: Record<number, string> = { 0: "Kladde", 1: "Kører", 2: "Pause", 3: "Færdig", 4: "Kører (underopsætning)", [-99]: "Suspenderet", [-1]: "Konto-problem", [-2]: "Bounce-beskyttelse" };

export async function campaignNumbers(): Promise<CampaignNumbers[] | null> {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key || !process.env.INSTANTLY_CAMPAIGN_ID) return null;
  const { coachCampaignId } = await import("./instantly-coach-campaign");
  const ids = [process.env.INSTANTLY_CAMPAIGN_ID, await coachCampaignId()].filter((x): x is string => Boolean(x));
  const qs = ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&");
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics?${qs}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const rows = await res.json() as Array<Record<string, any>>;
  return rows.map((r) => ({
    name: String(r.campaign_name ?? ""), status: STATUS[Number(r.campaign_status)] ?? String(r.campaign_status ?? ""),
    leads: Number(r.leads_count ?? 0), contacted: Number(r.contacted_count ?? 0), sent: Number(r.emails_sent_count ?? 0),
    replies: Number(r.reply_count_unique ?? r.reply_count ?? 0), opportunities: Number(r.total_opportunities ?? 0),
    bounced: Number(r.bounced_count ?? 0), unsubscribed: Number(r.unsubscribed_count ?? 0),
  }));
}

export async function signupNumbers() {
  const { foundingStatus } = await import("./club-onboarding");
  const founding = await foundingStatus().catch(() => null);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [clubs, clubsWeek, mailLogs] = await Promise.all([
    db.club.count({ where: { signupManaged: true } }).catch(() => 0),
    db.club.count({ where: { signupManaged: true, createdAt: { gte: since } } }).catch(() => 0),
    db.platformSetting.findMany({ where: { key: { startsWith: "mail:log:" } }, orderBy: { key: "desc" }, take: 300 }).catch(() => []),
  ]);
  let aiReplies = 0, escalated = 0, interested = 0;
  for (const l of mailLogs) {
    try {
      const v = JSON.parse(l.value);
      if (v.channel !== "sales" || Date.parse(v.at ?? "") < since.getTime()) continue;
      if (v.action === "reply" && v.sent !== false) aiReplies++;
      if (v.action === "escalate") escalated++;
      if (v.interest === "interested") interested++;
    } catch { /* skip */ }
  }
  return { founding, clubs, clubsWeek, aiReplies, escalated, interested };
}
