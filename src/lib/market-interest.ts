// The notify-me waitlist, end to end.
//
//   register  → validate, rate-limit, upsert one row per (email, kind,
//               sport, place), send a confirmation e-mail with signed links.
//   confirm   → the player clicks the link; the row counts as real demand.
//   notify    → when a club is approved (or a coach goes live) in the US,
//               confirmed, un-notified rows within NOTIFY_RADIUS_MILES of
//               the place, for the same sport and kind, get one e-mail.
//   unsubscribe → deletes the row.
//   prune     → retention: unconfirmed rows after 30 days, notified rows
//               after 180 days.
//
// Everything a player is told in the UI is backed by one of these steps.
import { db } from "./db";
import { getSettings } from "./settings";
import { sendMail } from "./email";
import { resolvePlace, distanceMiles, boundsAround, type Place } from "./us-places";
import { placeKey } from "./discovery";
import { sportLabel } from "./sports";
import {
  validateInterestInput, interestByIp, interestByEmail, clientAddress, addressFingerprint,
  interestLinks, validInterestToken, UNCONFIRMED_RETENTION_DAYS, NOTIFIED_RETENTION_DAYS, NOTIFY_RADIUS_MILES,
  type InterestKind,
} from "./market-interest-core";

export type RegisterOutcome =
  | { ok: true; label: string; confirmationSent: boolean; alreadyConfirmed: boolean }
  | { ok: false; error: string; status: 400 | 429 };

/**
 * Registers interest. Idempotent per (email, kind, sport, place): repeats
 * refresh the label and re-send the confirmation at most once an hour.
 */
export async function registerInterest(raw: { email?: unknown; kind?: unknown; sport?: unknown; q?: unknown }, context: { headers: Headers; userId?: string | null; source: "web" | "api" }): Promise<RegisterOutcome> {
  const parsed = validateInterestInput(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  const { email, kind, sport, query } = parsed.value;
  const address = clientAddress(context.headers);
  if ((address && !interestByIp.allow(address)) || !interestByEmail.allow(email)) {
    return { ok: false, error: "Too many requests. Please try again in a few minutes.", status: 429 };
  }
  const place = await resolvePlace(query);
  if (!place) return { ok: false, error: "Enter a US city, state or ZIP code so we know where to look.", status: 400 };

  const key = placeKey(place);
  const existing = await db.marketInterest.findUnique({ where: { email_kind_sport_placeKey: { email, kind, sport, placeKey: key } } });
  const row = existing
    ? await db.marketInterest.update({ where: { id: existing.id }, data: { label: place.label, userId: context.userId ?? existing.userId } })
    : await db.marketInterest.create({
        data: { email, kind, sport, placeKey: key, label: place.label, state: place.state, latitude: place.latitude, longitude: place.longitude, userId: context.userId ?? null, source: context.source, ipFingerprint: addressFingerprint(address) },
      });

  if (row.confirmedAt) return { ok: true, label: place.label, confirmationSent: false, alreadyConfirmed: true };

  // One confirmation mail per hour per row, however often the form is submitted.
  const recentlyMailed = row.confirmMailAt && Date.now() - row.confirmMailAt.getTime() < 60 * 60 * 1000;
  let confirmationSent = false;
  if (!recentlyMailed) {
    confirmationSent = await sendMail(confirmationMail(row.id, email, kind, sport, place.label, (await getSettings()).appUrl));
    if (confirmationSent) await db.marketInterest.update({ where: { id: row.id }, data: { confirmMailAt: new Date() } });
  }
  return { ok: true, label: place.label, confirmationSent, alreadyConfirmed: false };
}

function confirmationMail(id: string, to: string, kind: InterestKind, sport: string, label: string, appUrl: string) {
  const links = interestLinks(appUrl, id);
  const what = kind === "COURTS" ? `${sportLabel(sport, "en-US").toLowerCase()} courts` : `${sportLabel(sport, "en-US").toLowerCase()} coaches`;
  return {
    to,
    subject: `Confirm: tell me when ${what} open near ${label}`,
    body: [
      `Hi,`,
      ``,
      `You asked RacketBuddy to let you know when ${what} become bookable near ${label}.`,
      ``,
      `Confirm your email to switch that on:`,
      links.confirm,
      ``,
      `You will get one email when it happens — no newsletter. If you did not ask for this, ignore this message and nothing will be sent.`,
      ``,
      `Unsubscribe at any time: ${links.unsubscribe}`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  };
}

export async function confirmInterest(id: string, token: string): Promise<"confirmed" | "already" | "invalid"> {
  if (!validInterestToken(id, "confirm", token)) return "invalid";
  const row = await db.marketInterest.findUnique({ where: { id } });
  if (!row) return "invalid";
  if (row.confirmedAt) return "already";
  await db.marketInterest.update({ where: { id }, data: { confirmedAt: new Date() } });
  return "confirmed";
}

export async function unsubscribeInterest(id: string, token: string): Promise<boolean> {
  if (!validInterestToken(id, "unsubscribe", token)) return false;
  await db.marketInterest.deleteMany({ where: { id } });
  return true;
}

/** Retention. Safe to call often; deletes are bounded by the two rules only. */
export async function pruneInterest(now = new Date()) {
  const unconfirmedBefore = new Date(now.getTime() - UNCONFIRMED_RETENTION_DAYS * 86_400_000);
  const notifiedBefore = new Date(now.getTime() - NOTIFIED_RETENTION_DAYS * 86_400_000);
  const [a, b] = await Promise.all([
    db.marketInterest.deleteMany({ where: { confirmedAt: null, createdAt: { lt: unconfirmedBefore } } }),
    db.marketInterest.deleteMany({ where: { notifiedAt: { not: null, lt: notifiedBefore } } }),
  ]);
  return { unconfirmedDeleted: a.count, notifiedDeleted: b.count };
}

export type SupplyEvent = {
  kind: InterestKind;
  /** Club or coach id, recorded on the rows that were notified. */
  id: string;
  name: string;
  /** Public URL of the club page or coach profile. */
  href: string;
  sports: string[];
  latitude: number | null;
  longitude: number | null;
  state: string | null;
  city: string | null;
};

/**
 * Tells confirmed, un-notified players within NOTIFY_RADIUS_MILES that
 * supply opened. One e-mail per row; the row is marked before sending so a
 * retry cannot send twice. Returns how many were notified.
 */
export async function notifyInterestForSupply(event: SupplyEvent): Promise<number> {
  if (!event.sports.length) return 0;
  const box = event.latitude != null && event.longitude != null ? boundsAround({ latitude: event.latitude, longitude: event.longitude }, NOTIFY_RADIUS_MILES) : null;
  const candidates = await db.marketInterest.findMany({
    where: {
      kind: event.kind,
      sport: { in: event.sports },
      confirmedAt: { not: null },
      notifiedAt: null,
      OR: [
        ...(box ? [{ latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLon, lte: box.maxLon } }] : []),
        ...(event.state ? [{ placeKey: `state:${event.state.toLowerCase()}` }] : []),
      ],
    },
    take: 2_000,
  });
  const origin = event.latitude != null && event.longitude != null ? { latitude: event.latitude, longitude: event.longitude } : null;
  const { appUrl } = await getSettings();
  let sent = 0;
  for (const row of candidates) {
    const isState = row.placeKey.startsWith("state:");
    if (!isState && (!origin || row.latitude == null || row.longitude == null || distanceMiles(origin, { latitude: row.latitude, longitude: row.longitude }) > NOTIFY_RADIUS_MILES)) continue;
    // Claim before sending: a crash between the update and the mail loses one
    // notice, which is better than a retry sending two.
    const claimed = await db.marketInterest.updateMany({ where: { id: row.id, notifiedAt: null }, data: { notifiedAt: new Date(), notifiedAbout: event.id } });
    if (!claimed.count) continue;
    const links = interestLinks(appUrl, row.id);
    const what = event.kind === "COURTS" ? `${sportLabel(row.sport, "en-US")} courts` : `A ${sportLabel(row.sport, "en-US").toLowerCase()} coach`;
    await sendMail({
      to: row.email,
      subject: `${what} ${event.kind === "COURTS" ? "are" : "is"} now bookable near ${row.label}`,
      body: [
        `Hi,`,
        ``,
        `You asked us to tell you when ${event.kind === "COURTS" ? "courts" : "a coach"} opened near ${row.label}. ${event.name}${event.city ? ` in ${event.city}` : ""} is now live on RacketBuddy:`,
        `${appUrl.replace(/\/+$/, "")}${event.href}`,
        ``,
        `That was the one email we promised. You will not hear from us about ${row.label} again unless you sign up anew.`,
        ``,
        `Remove your address entirely: ${links.unsubscribe}`,
        ``,
        `RacketBuddy`,
      ].join("\n"),
    });
    sent += 1;
  }
  return sent;
}

/** Fires notifications for a club that just became bookable. Never throws into the caller's flow. */
export async function notifyInterestForClub(clubId: string): Promise<number> {
  try {
    const club = await db.club.findUnique({ where: { id: clubId }, include: { courts: { select: { sport: true } } } });
    if (!club || club.status !== "APPROVED" || club.country !== "US") return 0;
    const sports = Array.from(new Set([...club.courts.map((c) => c.sport), ...club.sports.split(",").map((s) => s.trim()).filter(Boolean)]));
    const state = club.address?.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/)?.[1] ?? null;
    return await notifyInterestForSupply({ kind: "COURTS", id: club.id, name: club.name, href: `/clubs/${club.slug}`, sports, latitude: club.latitude, longitude: club.longitude, state, city: club.city });
  } catch (error) {
    console.error("market interest: club notification failed", clubId, error);
    return 0;
  }
}

/** Fires notifications for a coach profile that just went live in the US. */
export async function notifyInterestForCoach(coachProfileId: string): Promise<number> {
  try {
    const coach = await db.coachProfile.findUnique({ where: { id: coachProfileId }, include: { user: { select: { name: true } } } });
    if (!coach || coach.country !== "US") return 0;
    const place: Place | null = coach.area ? await resolvePlace(coach.area) : null;
    return await notifyInterestForSupply({ kind: "COACHES", id: coach.id, name: coach.user.name, href: `/coaches/${coach.id}`, sports: coach.sports.split(",").map((s) => s.trim()).filter(Boolean), latitude: place?.latitude ?? null, longitude: place?.longitude ?? null, state: place?.state ?? null, city: place?.city ?? null });
  } catch (error) {
    console.error("market interest: coach notification failed", coachProfileId, error);
    return 0;
  }
}

export type DemandRow = { state: string | null; label: string; placeKey: string; kind: string; sport: string; confirmed: number; pending: number; notified: number; latest: Date };

/** Demand by market for the owner's sales view: grouped by place, kind and sport. */
export async function marketInterestSummary(limit = 200): Promise<DemandRow[]> {
  const rows = await db.marketInterest.findMany({
    select: { state: true, label: true, placeKey: true, kind: true, sport: true, confirmedAt: true, notifiedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20_000,
  });
  const groups = new Map<string, DemandRow>();
  for (const r of rows) {
    const key = `${r.placeKey}|${r.kind}|${r.sport}`;
    const g = groups.get(key) ?? { state: r.state, label: r.label, placeKey: r.placeKey, kind: r.kind, sport: r.sport, confirmed: 0, pending: 0, notified: 0, latest: r.createdAt };
    if (r.notifiedAt) g.notified += 1;
    else if (r.confirmedAt) g.confirmed += 1;
    else g.pending += 1;
    if (r.createdAt > g.latest) g.latest = r.createdAt;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.confirmed - a.confirmed || b.pending - a.pending || +b.latest - +a.latest).slice(0, limit);
}
