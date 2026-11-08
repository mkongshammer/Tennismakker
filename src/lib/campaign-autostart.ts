// Starts the two Instantly sales campaigns (clubs + coaches) after a short
// preflight, so nobody has to be at a computer. Moved forward on 6 Nov 2026
// at the owner's request (the iPhone app went live): the campaigns start at
// once and send from Monday 9 Nov, 8:00 US East Coast time. Runs from the US cron; does
// nothing before the launch time or once it has succeeded.
import { db } from "./db";

export const CAMPAIGN_LAUNCH_AT = new Date("2026-11-06T20:45:00Z");
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
    // The schedule may still carry the old start date; send from today.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(now);
    if (c.campaign_schedule?.start_date && String(c.campaign_schedule.start_date) > today) {
      const up = await api(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ campaign_schedule: { ...c.campaign_schedule, start_date: today } }) });
      if (!up.ok) { problems.push(`${name}: startdato kunne ikke flyttes (${up.status})`); continue; }
    }
    const act = await api(`/campaigns/${encodeURIComponent(id)}/activate`, { method: "POST", body: "{}" });
    if (!act.ok) { problems.push(`${name}: start fejlede (${act.status} ${(await act.text()).slice(0, 120)})`); continue; }
    started.push(name);
  }
  const { tellOwner } = await import("./founding-offer");
  const leads = await db.platformSetting.count({ where: { key: { startsWith: "sales:lead:" } } }).catch(() => 0);
  if (!problems.length) {
    await db.platformSetting.upsert({ where: { key: DONE }, create: { key: DONE, value: now.toISOString() }, update: { value: now.toISOString() } });
    await tellOwner("RacketBuddy: salgskampagnerne er startet", `Kampagnerne kører nu: ${started.join(", ")}.\n\nDe sender mandag–fredag kl. 8–18 amerikansk østkysttid (op til 100 mails om dagen til klubber og 20 til trænere). Svar besvares automatisk af AI'en, og interesserede klubber sendes videre til dig.${leads ? `\n\nKontakter i systemet: ${leads}.` : ""}`);
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

// 6 Nov 2026, owner's request: send from now on, not only 8–12 East Coast
// time. Widens both campaigns' sending window to 8:00–18:00 (US business
// hours) once. Runs every minute until it has succeeded.
const WINDOW_DONE = "sales:campaign-window-0800-1800:done";
export async function runCampaignWindowWiden() {
  if (await db.platformSetting.findUnique({ where: { key: WINDOW_DONE } })) return { done: true };
  if (!process.env.INSTANTLY_API_KEY || !process.env.INSTANTLY_CAMPAIGN_ID) return { error: "no-instantly-config" };
  const { coachCampaignId } = await import("./instantly-coach-campaign");
  const ids = [process.env.INSTANTLY_CAMPAIGN_ID, await coachCampaignId()].filter((x): x is string => Boolean(x));
  const out: string[] = [];
  for (const id of ids) {
    const res = await api(`/campaigns/${encodeURIComponent(id)}`);
    if (!res.ok) return { error: `read ${id} ${res.status}` };
    const c = await res.json() as Record<string, any>;
    const schedule = { ...c.campaign_schedule, schedules: (c.campaign_schedule?.schedules ?? []).map((s: any) => ({ ...s, timing: { from: "08:00", to: "18:00" } })) };
    const up = await api(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ campaign_schedule: schedule }) });
    if (!up.ok) return { error: `patch ${id} ${up.status} ${(await up.text()).slice(0, 120)}` };
    out.push(String(c.name ?? id));
  }
  await db.platformSetting.create({ data: { key: WINDOW_DONE, value: new Date().toISOString() } });
  return { widened: out };
}

// 7 Nov 2026: the owner asked for the current numbers while away from a
// computer. E-mails the campaign figures once.
const NUMBERS_SENT = "sales:campaign-numbers-mail:2026-11-07";
export async function mailCampaignNumbersOnce() {
  if (await db.platformSetting.findUnique({ where: { key: NUMBERS_SENT } })) return { done: true };
  const { campaignNumbers } = await import("./sales-overview");
  const rows = await campaignNumbers();
  if (!rows) return { error: "no-numbers" };
  const lines = rows.map((r) => `${r.name}: ${r.contacted} kontaktet af ${r.leads}, ${r.sent} mails sendt, ${r.replies} svar, ${r.bounced} bounce, ${r.unsubscribed} afmeldt`);
  await db.platformSetting.create({ data: { key: NUMBERS_SENT, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: kampagnetal lige nu", `${lines.join("\n")}\n\nKampagnerne sender mandag–fredag kl. 8–18 amerikansk østkysttid (14–24 dansk tid). Næste runde: mandag.`);
  return { sent: lines };
}

// 8 Nov 2026 evening: the owner asked (from his phone) how many clubs were
// added today. E-mails today's lead numbers once.
const LEADS_MAIL = "sales:lead-numbers-mail:2026-11-08";
export async function mailLeadNumbersOnce(now = new Date()) {
  if (await db.platformSetting.findUnique({ where: { key: LEADS_MAIL } })) return { done: true };
  await db.platformSetting.create({ data: { key: LEADS_MAIL, value: now.toISOString() } });
  const { leadCounts, harvestStats } = await import("./lead-harvest");
  const midnight = Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(now) + "T00:00:00+01:00");
  const [clubs, coaches, stats] = await Promise.all([leadCounts(now, "club"), leadCounts(now, "coach"), harvestStats(1, now)]);
  const today = (k: string) => stats.find((s) => s.key.startsWith(k));
  const line = (k: string) => { const s = today(k) as Record<string, unknown> | undefined; return s ? `${s.checked ?? 0} steder tjekket, ${s.added ?? 0} tilføjet` : "ingen kørsel registreret i dag"; };
  const cities = clubs.byCity.slice(0, 8).map(([c, n]) => `${c} (${n})`).join(", ");
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: nye klubber på listen i dag",
    `Klubber tilføjet i dag: ${clubs.since(midnight)} (i alt ${clubs.total}).\nTrænere tilføjet i dag: ${coaches.since(midnight)} (i alt ${coaches.total}).\n\nSøgningen i dag (UTC-døgn):\n- Klubber: ${line("club")}\n- Trænere: ${line("coach")}\n\nFlest klubber pr. by: ${cities}`);
  return { clubsToday: clubs.since(midnight) };
}
