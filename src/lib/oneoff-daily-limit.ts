// One-off (13 Nov 2026): owner raised the clubs campaign to 150 mails a day,
// so follow-ups no longer crowd out first mails to new clubs. The 6 sending
// mailboxes allow 180 a day (30 each), shared with the coaches campaign.
import { db } from "./db";

const FLAG = "oneoff:clubs-daily-limit-150:2026-11-13";

export async function raiseDailyLimitOnce() {
  const key = process.env.INSTANTLY_API_KEY, id = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !id) return;
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ daily_limit: 150 }), signal: AbortSignal.timeout(15_000) });
  const body = await res.text();
  await db.platformSetting.create({ data: { key: FLAG, value: JSON.stringify({ at: new Date().toISOString(), status: res.status }) } });
  const { tellOwner } = await import("./founding-offer");
  await tellOwner(res.ok ? "RacketBuddy: kampagnen sender nu op til 150 mails om dagen" : "RacketBuddy: grænsen på 150 mails om dagen kunne ikke sættes", res.ok ? "Klubkampagnen sender nu op til 150 mails om dagen (før 100), så opfølgninger ikke længere fortrænger første mail til nye klubber." : `Instantly svarede ${res.status}: ${body.slice(0, 200)}. Sig til Claude.`);
}
