// Daily sales e-mail to the owner (08:00 Copenhagen): clubs and coaches
// contacted since yesterday, replies, new leads, and where the contacted
// ones are (state and city).
import { db } from "./db";
import { sendMail } from "./email";
import { allLeads, leadCounts, type LeadKind } from "./lead-harvest";
import { deploymentRegion } from "./region";

const SNAP_KEY = "sales:digest:snapshot:v2";
type Nums = { leads: number; pushed: number; contacted: number; sent: number; replies: number; bounced: number; opportunities: number };
type Snapshot = { at: string; club: Nums; coach: Nums };

const campaignOf = async (k: LeadKind) => (k === "club" ? process.env.INSTANTLY_CAMPAIGN_ID : (await import("./instantly-coach-campaign")).coachCampaignId());

async function analytics(kind: LeadKind) {
  const key = process.env.INSTANTLY_API_KEY, id = await campaignOf(kind);
  if (!key || !id) return null;
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw Error(`Instantly ${res.status}`);
  const data = await res.json();
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  const n = (k: string) => Number(row[k] ?? 0) || 0;
  return { status: row.campaign_status as number | undefined, contacted: n("contacted_count"), sent: n("emails_sent_count"), replies: n("reply_count_unique") || n("reply_count"), bounced: n("bounced_count"), opportunities: n("total_opportunities") };
}

/** Where the contacted leads are: Instantly's contacted leads, located by our own lead records (or the lead's custom variables). */
async function contactedPlaces(kind: LeadKind) {
  const key = process.env.INSTANTLY_API_KEY, id = await campaignOf(kind);
  if (!key || !id) return null;
  const ours = new Map((await allLeads(kind)).map((r) => [r.lead.email, r.lead]));
  const states = new Map<string, number>(), cities = new Map<string, number>();
  let cursor: string | undefined, total = 0;
  for (let page = 0; page < 30; page++) {
    const res = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ campaign: id, limit: 100, filter: "FILTER_VAL_CONTACTED", ...(cursor ? { starting_after: cursor } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw Error(`Instantly leads ${res.status}`);
    const data = await res.json() as { items?: Array<Record<string, unknown>>; next_starting_after?: string };
    for (const item of data.items ?? []) {
      total++;
      const email = String(item.email ?? "").toLowerCase();
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      const state = String(ours.get(email)?.state || payload.state || "Unknown");
      const city = String(ours.get(email)?.city || payload.city || "");
      states.set(state, (states.get(state) ?? 0) + 1);
      if (city) cities.set(`${city}, ${state}`, (cities.get(`${city}, ${state}`) ?? 0) + 1);
    }
    if (!data.next_starting_after || !(data.items ?? []).length) break;
    cursor = data.next_starting_after;
  }
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { total, states: top(states, 12), cities: top(cities, 10) };
}

function copenhagen(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

async function section(kind: LeadKind, now: Date, prev: Nums | undefined) {
  const label = kind === "club" ? "KLUBBER" : "TRÆNERE";
  const counts = await leadCounts(now, kind);
  const a = await analytics(kind).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  const ok = a && !("error" in a) ? a : null;
  const nums: Nums = { leads: counts.total, pushed: counts.pushed, contacted: ok?.contacted ?? prev?.contacted ?? 0, sent: ok?.sent ?? prev?.sent ?? 0, replies: ok?.replies ?? prev?.replies ?? 0, bounced: ok?.bounced ?? prev?.bounced ?? 0, opportunities: ok?.opportunities ?? prev?.opportunities ?? 0 };
  const d = (k: keyof Nums) => Math.max(0, nums[k] - (prev?.[k] ?? 0));
  const places = await contactedPlaces(kind).catch(() => null);
  const status = ok?.status === 1 ? "kører" : ok?.status === 0 ? "kladde, ikke startet" : ok?.status === 2 ? "på pause" : ok ? "ukendt status" : (await campaignOf(kind)) ? "tal kunne ikke hentes" : "ingen kampagne sat op endnu";
  const lines = [
    `${label} (kampagnen: ${status})`,
    `Kontaktet siden i går: ${d("contacted")}  (i alt ${nums.contacted})`,
    `Svar siden i går: ${d("replies")}  (i alt ${nums.replies})${nums.opportunities ? ` · muligheder ${nums.opportunities}` : ""} · bounces ${d("bounced")}`,
    `Nye på listen siden i går: ${d("leads")}  (i alt ${nums.leads}, ${nums.pushed} i Instantly, ${counts.lastWeek} de sidste 7 dage)`,
  ];
  if (places && places.total) {
    lines.push(`Kontaktede pr. stat: ${places.states.map(([s, n]) => `${s} ${n}`).join(" · ")}`);
    if (places.cities.length) lines.push(`Byer: ${places.cities.map(([c, n]) => `${c} (${n})`).join(" · ")}`);
  } else if (counts.byState.length) {
    lines.push(`På listen pr. stat: ${counts.byState.slice(0, 10).map(([s, n]) => `${s} ${n}`).join(" · ")}`);
  }
  if (counts.lastWeek === 0) lines.push(`OBS: ingen nye ${kind === "club" ? "klubber" : "trænere"} de sidste 7 dage. Tjek AI Agents og OpenAI-kreditten.`);
  return { nums, lines, contactedToday: d("contacted"), newToday: d("leads") };
}

export async function runDailySalesDigest(now = new Date(), force = false) {
  if (deploymentRegion() !== "US") return { sent: false, reason: "not-us" };
  const { date, hour } = copenhagen(now);
  const dayKey = `sales:digest:${date}`;
  if (!force && (hour < 8 || await db.platformSetting.findUnique({ where: { key: dayKey } }))) return { sent: false, reason: "not-due" };
  const recipients = (process.env.SALES_DIGEST_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) recipients.push(...(await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { email: true } })).map((o) => o.email));
  if (!recipients.length) return { sent: false, reason: "no-recipient" };
  const prevRow = await db.platformSetting.findUnique({ where: { key: SNAP_KEY } });
  const prev: Snapshot | null = prevRow ? JSON.parse(prevRow.value) : null;
  const club = await section("club", now, prev?.club);
  const coach = await section("coach", now, prev?.coach);
  const { mailStats } = await import("./email-assistant");
  const m = await mailStats(new Date(now.getTime() - 86_400_000)).catch(() => null);
  const mailLines = m ? [
    "AI-SVAR PÅ MAILS (sidste døgn)",
    `Support: ${m.support.answered} besvaret af AI, ${m.support.escalated} sendt videre til dig, ${m.support.ignored} sorteret fra`,
    `Salgssvar: ${m.sales.answered} besvaret af AI, ${m.sales.escalated} sendt videre til dig, ${m.interested} interesserede`,
  ] : [];
  const body = ["Godmorgen Magnus,", "", ...club.lines, "", ...coach.lines, "", ...mailLines, ...(mailLines.length ? [""] : []), "Detaljer: https://racketbuddy.app/superadmin/salg · Mails: https://racketbuddy.app/superadmin/mails"].join("\n");
  const subject = `RacketBuddy salg: ${club.contactedToday} klubber + ${coach.contactedToday} trænere kontaktet, ${club.newToday + coach.newToday} nye på listen`;
  let ok = false;
  for (const to of recipients) ok = (await sendMail({ to, subject, body })) || ok;
  const snap: Snapshot = { at: now.toISOString(), club: club.nums, coach: coach.nums };
  await db.platformSetting.upsert({ where: { key: SNAP_KEY }, create: { key: SNAP_KEY, value: JSON.stringify(snap) }, update: { value: JSON.stringify(snap) } });
  if (ok) await db.platformSetting.upsert({ where: { key: dayKey }, create: { key: dayKey, value: now.toISOString() }, update: { value: now.toISOString() } });
  return { sent: ok, recipients: recipients.length };
}
