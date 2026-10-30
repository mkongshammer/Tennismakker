// Keeps the founding-club offer in step everywhere outside the web app:
//  - the Instantly sales e-mails (club and coach campaigns) carry the
//    founding wording while spots are left, and switch to the regular price
//    by themselves when the 25th founding club has signed up;
//  - the owner is told when 5 spots are left and when the offer closes.
// Pages, the signup form, Stripe checkout and the AI read the live price
// from club-onboarding, so they need nothing here.
import { db } from "./db";
import { sendMail } from "./email";
import { foundingStatus } from "./club-onboarding";
import { CLUB_MONTHLY_USD, FOUNDING_CLUB_SPOTS, FOUNDING_MONTHLY_USD } from "./platform-pricing";

export const FOUNDING_PHRASE = `$${FOUNDING_MONTHLY_USD} a month (locked in for life for our first ${FOUNDING_CLUB_SPOTS} clubs, $${CLUB_MONTHLY_USD} after that)`;
const PLAIN_FOUNDING = new RegExp(`\\$${FOUNDING_MONTHLY_USD} a month(?! \\(locked)`, "g");
const REGULAR_PHRASE = `$${CLUB_MONTHLY_USD} a month`;

/** Rewrites the price wording in a text. Pure, for tests. */
export function rewritePrice(text: string, mode: "founding" | "regular") {
  return mode === "founding"
    ? text.replace(PLAIN_FOUNDING, FOUNDING_PHRASE)
    : text.split(FOUNDING_PHRASE).join(REGULAR_PHRASE).replace(PLAIN_FOUNDING, REGULAR_PHRASE);
}

type Variant = { subject?: string; body?: string; [k: string]: unknown };
type Campaign = { id: string; name?: string; sequences?: Array<{ steps?: Array<{ variants?: Variant[]; [k: string]: unknown }>; [k: string]: unknown }> };

async function instantly(path: string, init: RequestInit = {}) {
  return fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
}

/** Updates the price wording in both sales campaigns. Returns how many e-mail variants changed. */
export async function setCampaignPriceCopy(mode: "founding" | "regular") {
  if (!process.env.INSTANTLY_API_KEY) return { changed: 0, error: "no-instantly-key" };
  const { coachCampaignId } = await import("./instantly-coach-campaign");
  const ids = [process.env.INSTANTLY_CAMPAIGN_ID, await coachCampaignId()].filter((x): x is string => Boolean(x));
  let changed = 0;
  const errors: string[] = [];
  for (const id of ids) {
    const res = await instantly(`/campaigns/${encodeURIComponent(id)}`);
    if (!res.ok) { errors.push(`get ${id}: ${res.status}`); continue; }
    const c = await res.json() as Campaign;
    let n = 0;
    const sequences = (c.sequences ?? []).map((seq) => ({ ...seq, steps: (seq.steps ?? []).map((step) => ({ ...step, variants: (step.variants ?? []).map((v) => {
      const body = typeof v.body === "string" ? rewritePrice(v.body, mode) : v.body;
      const subject = typeof v.subject === "string" ? rewritePrice(v.subject, mode) : v.subject;
      if (body !== v.body || subject !== v.subject) n++;
      return { ...v, body, subject };
    }) })) }));
    if (!n) continue;
    const up = await instantly(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ sequences }) });
    if (!up.ok) { errors.push(`patch ${id}: ${up.status} ${(await up.text()).slice(0, 120)}`); continue; }
    changed += n;
  }
  return { changed, ...(errors.length ? { error: errors.join("; ") } : {}) };
}

async function tellOwner(subject: string, body: string) {
  const to = (process.env.SALES_DIGEST_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) to.push(...(await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { email: true } })).map((u) => u.email));
  for (const t of to) await sendMail({ to: t, subject, body });
}

async function once(key: string) {
  try { await db.platformSetting.create({ data: { key, value: new Date().toISOString() } }); return true; } catch { return false; }
}

/** Cron (US): warns at 5 spots left, and closes the offer in the sales e-mails when the spots are gone. */
export async function runFoundingWatch() {
  const f = await foundingStatus();
  if (f.left <= 5 && f.left > 0 && await once("founding:warned-5")) {
    await tellOwner(`RacketBuddy: ${f.left} founding-club-pladser tilbage`, `${f.taken} af ${f.total} founding-klubber er tilmeldt. Når de sidste ${f.left} er taget, skifter prisen for nye klubber automatisk til $${CLUB_MONTHLY_USD}/md, både på hjemmesiden, i betalingen og i salgsmailene.`);
  }
  if (f.open) return { open: true, left: f.left };
  if (await db.platformSetting.findUnique({ where: { key: "founding:closed" } })) return { open: false, done: true };
  const r = await setCampaignPriceCopy("regular");
  if (r.error) {
    console.error("[founding] could not update the sales e-mails:", r.error);
    if (await once("founding:close-failed-mail")) await tellOwner("RacketBuddy: founding-tilbuddet er udsolgt, men salgsmailene kunne ikke opdateres", `Alle ${f.total} founding-pladser er taget, og hjemmesiden, betalingen og AI'en viser nu $${CLUB_MONTHLY_USD}/md. Instantly-mailene kunne ikke opdateres automatisk (${r.error}). Ret "${FOUNDING_PHRASE}" til "${REGULAR_PHRASE}" i kampagnerne. Systemet prøver igen hver time.`);
    return { open: false, error: r.error };
  }
  await once("founding:closed");
  await tellOwner("RacketBuddy: alle 25 founding-klubber er tilmeldt", `Alle ${f.total} founding-pladser er taget. Nye klubber betaler nu $${CLUB_MONTHLY_USD}/md eller $999/år. Hjemmesiden, betalingen, appens tekster, AI-svarene og salgsmailene i Instantly (${r.changed} mailvarianter) er opdateret automatisk. Founding-klubberne beholder $${FOUNDING_MONTHLY_USD}/md for altid.`);
  return { open: false, changed: r.changed };
}
