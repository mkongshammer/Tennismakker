// Daily sales e-mail to the owner (08:00 Copenhagen): new club leads, how
// many are in Instantly, and how many clubs the campaign has contacted and
// heard back from since yesterday.
import { db } from "./db";
import { sendMail } from "./email";
import { leadCounts } from "./lead-harvest";
import { deploymentRegion } from "./region";

const SNAP_KEY = "sales:digest:snapshot";

type Snapshot = { at: string; leads: number; pushed: number; contacted: number; sent: number; replies: number; bounced: number; opportunities: number };

async function instantlyNumbers() {
  const key = process.env.INSTANTLY_API_KEY, id = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !id) return null;
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw Error(`Instantly ${res.status}`);
  const data = await res.json();
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  const n = (k: string) => Number(row[k] ?? 0) || 0;
  return { status: row.campaign_status, leads: n("leads_count"), contacted: n("contacted_count"), sent: n("emails_sent_count"), replies: n("reply_count_unique") || n("reply_count"), bounced: n("bounced_count"), opportunities: n("total_opportunities") };
}

function copenhagen(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export async function runDailySalesDigest(now = new Date(), force = false) {
  if (deploymentRegion() !== "US") return { sent: false, reason: "not-us" };
  const { date, hour } = copenhagen(now);
  const dayKey = `sales:digest:${date}`;
  if (!force && (hour < 8 || await db.platformSetting.findUnique({ where: { key: dayKey } }))) return { sent: false, reason: "not-due" };
  const recipients = (process.env.SALES_DIGEST_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) {
    const owners = await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { email: true } });
    recipients.push(...owners.map((o) => o.email));
  }
  if (!recipients.length) return { sent: false, reason: "no-recipient" };
  const leads = await leadCounts(now);
  const inst = await instantlyNumbers().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  const prevRow = await db.platformSetting.findUnique({ where: { key: SNAP_KEY } });
  const prev: Snapshot | null = prevRow ? JSON.parse(prevRow.value) : null;
  const i = inst && !("error" in inst) ? inst : null;
  const snap: Snapshot = { at: now.toISOString(), leads: leads.total, pushed: leads.pushed, contacted: i?.contacted ?? prev?.contacted ?? 0, sent: i?.sent ?? prev?.sent ?? 0, replies: i?.replies ?? prev?.replies ?? 0, bounced: i?.bounced ?? prev?.bounced ?? 0, opportunities: i?.opportunities ?? prev?.opportunities ?? 0 };
  const d = (k: keyof Omit<Snapshot, "at">) => Math.max(0, snap[k] - (prev?.[k] ?? 0));
  const status = i?.status === 1 ? "kører" : i?.status === 0 ? "kladde (ikke startet)" : i?.status === 2 ? "på pause" : i ? `status ${i.status}` : "ukendt";
  const body = [
    `Godmorgen Magnus,`,
    ``,
    `Klubber kontaktet siden i går: ${d("contacted")}  (i alt ${snap.contacted})`,
    `E-mails sendt siden i går: ${d("sent")}  (i alt ${snap.sent})`,
    `Svar siden i går: ${d("replies")}  (i alt ${snap.replies})${snap.opportunities ? ` · muligheder: ${snap.opportunities}` : ""}`,
    `Bounces siden i går: ${d("bounced")}`,
    ``,
    `Nye klubber på listen siden i går: ${d("leads")}  (i alt ${snap.leads}, heraf ${snap.pushed} i Instantly)`,
    `Sidste 7 dage: ${leads.lastWeek} nye klubber`,
    leads.byState.length ? `Fordeling: ${leads.byState.slice(0, 8).map(([s, n]) => `${s} ${n}`).join(" · ")}` : "",
    ``,
    i ? `Kampagnen er ${status}.` : `Instantly-tal kunne ikke hentes${inst && "error" in inst ? ` (${inst.error})` : ""}.`,
    leads.lastWeek === 0 ? `OBS: ingen nye klubber de sidste 7 dage. Tjek AI Agents og OpenAI-kreditten i superadmin.` : "",
    ``,
    `Detaljer: https://racketbuddy.app/superadmin/salg`,
  ].filter((l, idx, a) => !(l === "" && a[idx - 1] === "")).join("\n");
  let ok = false;
  for (const to of recipients) ok = (await sendMail({ to, subject: `RacketBuddy salg: ${d("contacted")} kontaktet, ${d("leads")} nye klubber`, body })) || ok;
  await db.platformSetting.upsert({ where: { key: SNAP_KEY }, create: { key: SNAP_KEY, value: JSON.stringify(snap) }, update: { value: JSON.stringify(snap) } });
  if (ok) await db.platformSetting.upsert({ where: { key: dayKey }, create: { key: dayKey, value: now.toISOString() }, update: { value: now.toISOString() } });
  return { ...snap, sent: ok, emailsSent: snap.sent, recipients: recipients.length };
}
