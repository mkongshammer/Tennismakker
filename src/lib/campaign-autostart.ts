// Starts the two Instantly sales campaigns (clubs + coaches) on the agreed
// launch morning — Tuesday 10 Nov 2026, 7:00 New York time — after a short
// preflight, so nobody has to be at a computer. Runs from the US cron; does
// nothing before the launch time or once it has succeeded.
import { db } from "./db";

export const CAMPAIGN_LAUNCH_AT = new Date("2026-11-10T12:00:00Z"); // 07:00 America/New_York
const DONE = "sales:campaign-autostart:done";
const NOTIFIED = "sales:campaign-autostart:notified-error";

async function api(path: string, init: RequestInit = {}) {
  return fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
}

export async function runCampaignAutostart(now = new Date()) {
  if (now < CAMPAIGN_LAUNCH_AT) return { waiting: true };
  if (await db.platformSetting.findUnique({ where: { key: DONE } })) return { done: true };
  if (!process.env.INSTANTLY_API_KEY || !process.env.INSTANTLY_CAMPAIGN_ID) return { error: "no-instantly-config" };
  const { coachCampaignId } = await import("./instantly-coach-campaign");
  const ids = [process.env.INSTANTLY_CAMPAIGN_ID, await coachCampaignId()].filter((x): x is string => Boolean(x));
  const problems: string[] = [];
  const started: string[] = [];
  for (const id of ids) {
    const res = await api(`/campaigns/${encodeURIComponent(id)}`);
    if (!res.ok) { problems.push(`${id}: kunne ikke læses (${res.status})`); continue; }
    const c = await res.json() as Record<string, any>;
    const name = String(c.name ?? id);
    if (c.status === 1) { started.push(`${name} (kørte allerede)`); continue; }
    // Preflight: e-mail steps with text, sending addresses, warm and active.
    const steps = c.sequences?.[0]?.steps ?? [];
    if (!steps.length || !steps.every((s: any) => (s.variants ?? []).some((v: any) => String(v.body ?? "").trim()))) { problems.push(`${name}: mangler mailtekst`); continue; }
    const emails: string[] = c.email_list ?? [];
    if (!emails.length) { problems.push(`${name}: ingen afsenderadresser`); continue; }
    const accounts = await Promise.all(emails.map((e) => api(`/accounts/${encodeURIComponent(e)}`).then((r) => r.ok ? r.json() : null).catch(() => null)));
    const healthy = accounts.filter((a: any) => a && a.status === 1).length;
    if (healthy < Math.ceil(emails.length / 2)) { problems.push(`${name}: kun ${healthy} af ${emails.length} afsenderadresser er aktive`); continue; }
    const act = await api(`/campaigns/${encodeURIComponent(id)}/activate`, { method: "POST", body: "{}" });
    if (!act.ok) { problems.push(`${name}: start fejlede (${act.status} ${(await act.text()).slice(0, 120)})`); continue; }
    started.push(name);
  }
  const { tellOwner } = await import("./founding-offer");
  const leads = await db.platformSetting.count({ where: { key: { startsWith: "sales:lead:" } } }).catch(() => 0);
  if (!problems.length) {
    await db.platformSetting.upsert({ where: { key: DONE }, create: { key: DONE, value: now.toISOString() }, update: { value: now.toISOString() } });
    await tellOwner("RacketBuddy: salgskampagnerne er startet", `Kampagnerne kører nu: ${started.join(", ")}.\n\nDe sender mandag–fredag kl. 8–12 amerikansk østkysttid (op til 100 mails om dagen til klubber og 20 til trænere). Svar besvares automatisk af AI'en, og interesserede klubber sendes videre til dig.${leads ? `\n\nKontakter i systemet: ${leads}.` : ""}`);
    return { started };
  }
  // Retry every run; tell the owner once per distinct problem set.
  const sig = problems.join("|");
  const prev = await db.platformSetting.findUnique({ where: { key: NOTIFIED } });
  if (prev?.value !== sig) {
    await db.platformSetting.upsert({ where: { key: NOTIFIED }, create: { key: NOTIFIED, value: sig }, update: { value: sig } });
    await tellOwner("RacketBuddy: salgskampagnerne kunne ikke startes", `Planlagt start ${CAMPAIGN_LAUNCH_AT.toISOString()} gik ikke igennem:\n- ${problems.join("\n- ")}${started.length ? `\n\nStartet: ${started.join(", ")}` : ""}\n\nSystemet prøver igen hvert kvarter.`);
  }
  return { started, problems };
}
