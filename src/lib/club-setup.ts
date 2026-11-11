// Automatic club set-up from a sales reply.
//
// The personal follow-up after a club opens its page offers to set the club
// up with its real courts, hours and prices. When the club answers, the mail
// AI pulls those details out of the reply (asking for whatever is missing),
// and they are stored here against the club's preview id. From then on:
//  - the club's page (racketbuddy.app/for/<id>) shows their real courts,
//    sports, opening hours and guest price instead of the example day;
//  - the claim link opens the signup with everything filled in, straight on
//    the last step (plan + password), so finishing takes a minute.
// Nothing is created in their name: the club still accepts the terms, sets
// its own password and pays itself.
import { db } from "./db";
import { SPORTS, sportLabel, type Sport } from "./sports";

export type CourtCount = { sport: Sport; count: number };
export type PreparedSetup = {
  courts: CourtCount[];
  openHour: number | null;
  closeHour: number | null;
  guestPrice: number | null;
  street: string | null;
  zip: string | null;
  contactName: string | null;
  updatedAt: string;
};
export type SetupInput = Partial<Omit<PreparedSetup, "updatedAt" | "courts">> & { courts?: { sport: string; count: number }[] };

const KEY = (id: string) => `sales:prepared-setup:${id}`;
export const DEFAULT_OPEN = 7;
export const DEFAULT_CLOSE = 22;

const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Cleans what the AI extracted: known sports only, sane counts, hours and price. */
export function cleanSetup(input: SetupInput): Omit<PreparedSetup, "updatedAt"> {
  const courts: CourtCount[] = [];
  for (const c of input.courts ?? []) {
    const sport = String(c.sport ?? "").toUpperCase().replace(/[^A-Z]/g, "") as Sport;
    const count = int(c.count, 1, 40);
    if ((SPORTS as readonly string[]).includes(sport) && count && !courts.some((x) => x.sport === sport)) courts.push({ sport, count });
  }
  let openHour = int(input.openHour, 0, 23), closeHour = int(input.closeHour, 1, 24);
  if (openHour !== null && closeHour !== null && closeHour <= openHour) { openHour = null; closeHour = null; }
  const price = Number(input.guestPrice);
  const str = (v: unknown, max: number) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s ? s.slice(0, max) : null; };
  const zip = str(input.zip, 10);
  return {
    courts,
    openHour, closeHour: closeHour === 24 ? 23 : closeHour,
    guestPrice: Number.isFinite(price) && price > 0 && price <= 1000 ? Math.round(price) : null,
    street: str(input.street, 150),
    zip: zip && /^\d{5}(-\d{4})?$/.test(zip) ? zip : null,
    contactName: str(input.contactName, 150),
  };
}

/** Courts and a guest price are enough to show the club working; hours fall back to 7–22. */
export function setupReady(s: Pick<PreparedSetup, "courts" | "guestPrice">) {
  return s.courts.length > 0 && s.guestPrice !== null;
}

export function missingForSetup(s: Pick<PreparedSetup, "courts" | "guestPrice" | "openHour">) {
  const out: string[] = [];
  if (!s.courts.length) out.push("how many courts you have for each sport");
  if (s.guestPrice === null) out.push("what a non-member pays per court-hour");
  if (s.openHour === null) out.push("your opening hours");
  return out;
}

export async function preparedSetup(id: string): Promise<PreparedSetup | null> {
  const row = await db.platformSetting.findUnique({ where: { key: KEY(id) } }).catch(() => null);
  if (!row) return null;
  try { return JSON.parse(row.value) as PreparedSetup; } catch { return null; }
}

/** Merges new details into what we already have (a later reply can fill in what an earlier one left out). */
export async function savePreparedSetup(id: string, input: SetupInput) {
  const prev = await preparedSetup(id);
  const next = cleanSetup(input);
  const merged: PreparedSetup = {
    courts: next.courts.length ? next.courts : prev?.courts ?? [],
    openHour: next.openHour ?? prev?.openHour ?? null,
    closeHour: next.closeHour ?? prev?.closeHour ?? null,
    guestPrice: next.guestPrice ?? prev?.guestPrice ?? null,
    street: next.street ?? prev?.street ?? null,
    zip: next.zip ?? prev?.zip ?? null,
    contactName: next.contactName ?? prev?.contactName ?? null,
    updatedAt: new Date().toISOString(),
  };
  await db.platformSetting.upsert({ where: { key: KEY(id) }, create: { key: KEY(id), value: JSON.stringify(merged) }, update: { value: JSON.stringify(merged) } });
  return merged;
}

const hourText = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
export function hoursText(s: Pick<PreparedSetup, "openHour" | "closeHour">) {
  return `${hourText(s.openHour ?? DEFAULT_OPEN)}–${hourText(s.closeHour ?? DEFAULT_CLOSE)}`;
}
export function courtsText(courts: CourtCount[]) {
  return courts.map((c) => `${c.count} ${sportLabel(c.sport, "en-US").toLowerCase()} ${c.sport === "BORDTENNIS" ? (c.count === 1 ? "table" : "tables") : c.count === 1 ? "court" : "courts"}`).join(" and ");
}

/** The claim link: signup prefilled from the lead and the prepared set-up. */
export function claimUrl(appUrl: string, id: string, lead: { clubName: string; city: string; state: string }, stateCode: string) {
  const q = new URLSearchParams({ club: lead.clubName, city: lead.city, state: stateCode, ref: id });
  return `${appUrl.replace(/\/+$/, "")}/list-your-club?${q}`;
}

/** The reply once the club is set up. Fixed wording, so the links and facts are always right. */
export function setupDoneMail(o: { firstName?: string; clubName: string; setup: PreparedSetup; page: string; claim: string }) {
  const hi = o.firstName ? `Hi ${o.firstName},` : "Hi,";
  const total = o.setup.courts.reduce((n, c) => n + c.count, 0);
  return `${hi}\n\nDone. ${o.clubName} is set up with your ${courtsText(o.setup.courts)} at $${o.setup.guestPrice}/hour, open ${hoursText(o.setup)}. You can see it working here:\n${o.page}\n\nWhen you're happy with it, claim it here. Everything is filled in, so you only choose monthly or yearly and set a password:\n${o.claim}\n\nCourt names, surfaces, member prices and peak hours can all be changed afterwards${total > 1 ? ", court by court" : ""}.\n\nMagnus`;
}
