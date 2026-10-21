// Club events (tournaments, leagues, socials, clinics) with sign-up and
// payment, and the club ladder.
//
// Events follow the season-team pattern: one row per sign-up, Stripe
// checkout with the event id in metadata, confirmed by the webhook. The
// ladder is a ranked list: beat someone above you and you take their rank,
// everyone between moves down one.
import { validateOrderCheckout, type CheckoutEvidence } from "./payment-validation";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { dataRegionForCountry } from "./region";
import { sendMail } from "./email";

export const EVENT_KINDS = ["TOURNAMENT", "LEAGUE", "SOCIAL", "CLINIC"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABEL: Record<EventKind, string> = { TOURNAMENT: "Tournament", LEAGUE: "League", SOCIAL: "Social", CLINIC: "Clinic" };

export async function upcomingEvents(clubId: string, userId?: string | null) {
  const events = await db.clubEvent.findMany({
    where: { clubId, active: true, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { signups: { where: { status: "PAID" } } } }, signups: userId ? { where: { userId }, select: { status: true } } : false },
  });
  return events.map((e: any) => ({
    id: e.id, name: e.name, description: e.description, kind: e.kind as EventKind, sport: e.sport, startsAt: e.startsAt, endsAt: e.endsAt, priceKr: e.priceKr, capacity: e.capacity,
    taken: e._count.signups, full: e.capacity > 0 && e._count.signups >= e.capacity,
    closed: Boolean(e.signupClosesAt && e.signupClosesAt < new Date()) || e.startsAt < new Date(),
    mine: (e.signups?.[0]?.status as string | undefined) ?? null,
  }));
}

export type EventSignupResult = { ok: true; checkoutUrl: string | null } | { ok: false; error: string };

export async function signUpForEvent(userId: string, eventId: string): Promise<EventSignupResult> {
  const ev = await db.clubEvent.findUnique({ where: { id: eventId }, include: { club: { select: { name: true, slug: true, currency: true, country: true, stripeAccountId: true, stripeChargesEnabled: true } } } });
  if (!ev || !ev.active) return { ok: false, error: "The event is not open." };
  if (ev.startsAt < new Date() || (ev.signupClosesAt && ev.signupClosesAt < new Date())) return { ok: false, error: "Sign-up has closed." };
  const existing = await db.eventSignup.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (existing?.status === "PAID") return { ok: false, error: "You're already signed up." };
  if (ev.capacity > 0) { const taken = await db.eventSignup.count({ where: { eventId, status: "PAID" } }); if (taken >= ev.capacity) return { ok: false, error: "The event is full." }; }

  const signup = existing
    ? await db.eventSignup.update({ where: { id: existing.id }, data: { priceKr: ev.priceKr, currency: ev.club.currency, status: "PENDING" } })
    : await db.eventSignup.create({ data: { eventId, userId, priceKr: ev.priceKr, currency: ev.club.currency } });
  const settings = await getSettings();
  if (ev.priceKr <= 0 || settings.paymentProvider !== "stripe") { await confirmEventSignup(signup.id); return { ok: true, checkoutUrl: null }; }
  if (!ev.club.stripeAccountId || !ev.club.stripeChargesEnabled) { await db.eventSignup.update({ where: { id: signup.id }, data: { status: "CANCELLED" } }); return { ok: false, error: "The club can't take payments yet. Contact the club." }; }

  const region = dataRegionForCountry(ev.club.country);
  const back = `${settings.appUrl}/clubs/${ev.club.slug}/events/${ev.id}`;
  const session = await (await stripe()).checkout.sessions.create({
    adaptive_pricing: { enabled: false }, mode: "payment",
    payment_intent_data: { transfer_data: { destination: ev.club.stripeAccountId }, metadata: { eventSignupId: signup.id, region } },
    line_items: [{ price_data: { currency: ev.club.currency.toLowerCase(), product_data: { name: ev.name, description: `${EVENT_KIND_LABEL[ev.kind as EventKind] ?? "Event"} at ${ev.club.name}` }, unit_amount: ev.priceKr * 100 }, quantity: 1 }],
    metadata: { eventSignupId: signup.id, region },
    success_url: `${back}?signup=ok`, cancel_url: `${back}?signup=cancelled`,
  });
  await db.eventSignup.update({ where: { id: signup.id }, data: { stripeSessionId: session.id } });
  if (!session.url) return { ok: false, error: "The payment page couldn't be opened." };
  return { ok: true, checkoutUrl: session.url };
}

export async function confirmEventSignup(signupId: string, session?: CheckoutEvidence) {
  if (session) { const order = await db.eventSignup.findUniqueOrThrow({ where: { id: signupId } }); validateOrderCheckout(order, session, "eventSignupId"); }
  const r = await db.eventSignup.updateMany({ where: { id: signupId, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date() } });
  if (!r.count) return;
  const s = await db.eventSignup.findUnique({ where: { id: signupId }, include: { user: true, event: { include: { club: { select: { name: true, timeZone: true } } } } } });
  if (!s) return;
  const { formatDate, formatMoney } = await import("./international");
  await sendMail({ to: s.user.email, subject: `${s.event.club.name}: you're in for ${s.event.name}`, body: [`Hi ${s.user.name}`, "", `You're signed up for ${s.event.name} at ${s.event.club.name}.`, "", `When: ${formatDate(s.event.startsAt, s.user.locale ?? "en-US", s.event.club.timeZone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`, s.priceKr > 0 ? `Paid: ${formatMoney(s.priceKr, s.currency, s.user.locale ?? "en-US")}` : "Price: free", "", "This e-mail is your receipt."].join("\n") }).catch(() => {});
}

/** The player backs out. Free or unpaid sign-ups only; paid ones go through the club. */
export async function withdrawFromEvent(userId: string, eventId: string) {
  const s = await db.eventSignup.findUnique({ where: { eventId_userId: { eventId, userId } }, include: { event: { select: { startsAt: true } } } });
  if (!s) return { ok: false as const, error: "No sign-up found." };
  if (s.status === "PAID" && s.priceKr > 0) return { ok: false as const, error: "You've paid for this event. Contact the club to cancel." };
  await db.eventSignup.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
  if (s.event.startsAt > new Date()) { const { notifyEventWaitlist } = await import("./waitlist"); await notifyEventWaitlist(eventId).catch(() => {}); }
  return { ok: true as const };
}

export async function myEventSignups(userId: string) {
  return db.eventSignup.findMany({ where: { userId, status: "PAID", event: { endsAt: { gte: new Date() } } }, include: { event: { include: { club: { select: { name: true, slug: true, timeZone: true } } } } }, orderBy: { event: { startsAt: "asc" } } });
}

// ---------- Ladder ----------

export async function ladderStandings(ladderId: string) {
  const entries = await db.ladderEntry.findMany({ where: { ladderId }, orderBy: { rank: "asc" }, include: { user: { select: { id: true, name: true, level: true } } } });
  return entries.map((e) => ({ id: e.id, userId: e.userId, name: e.user.name, level: e.user.level, rank: e.rank, wins: e.wins, losses: e.losses }));
}

export async function joinLadder(userId: string, ladderId: string) {
  const ladder = await db.ladder.findUnique({ where: { id: ladderId }, select: { active: true, clubId: true } });
  if (!ladder?.active) return { ok: false as const, error: "The ladder is closed." };
  const member = await db.user.findFirst({ where: { id: userId, clubId: ladder.clubId }, select: { id: true } });
  if (!member) return { ok: false as const, error: "Only club members can join the ladder." };
  const existing = await db.ladderEntry.findUnique({ where: { ladderId_userId: { ladderId, userId } } });
  if (existing) return { ok: true as const };
  const count = await db.ladderEntry.count({ where: { ladderId } });
  await db.ladderEntry.create({ data: { ladderId, userId, rank: count + 1 } });
  return { ok: true as const };
}

export async function reportLadderResult(reporterId: string, ladderId: string, winnerId: string, loserId: string, score: string | null) {
  if (winnerId === loserId) return { ok: false as const, error: "Pick two different players." };
  if (reporterId !== winnerId && reporterId !== loserId) return { ok: false as const, error: "Only one of the two players can report the result." };
  const [w, l] = await Promise.all([
    db.ladderEntry.findUnique({ where: { ladderId_userId: { ladderId, userId: winnerId } } }),
    db.ladderEntry.findUnique({ where: { ladderId_userId: { ladderId, userId: loserId } } }),
  ]);
  if (!w || !l) return { ok: false as const, error: "Both players must be on the ladder." };
  await db.$transaction(async (tx) => {
    if (w.rank > l.rank) {
      // Winner climbs to the loser's rank; everyone from the loser down to just above the winner drops one.
      await tx.ladderEntry.updateMany({ where: { ladderId, rank: { gte: l.rank, lt: w.rank } }, data: { rank: { increment: 1 } } });
      await tx.ladderEntry.update({ where: { id: w.id }, data: { rank: l.rank, wins: { increment: 1 } } });
      await tx.ladderEntry.update({ where: { id: l.id }, data: { losses: { increment: 1 } } });
    } else {
      await tx.ladderEntry.update({ where: { id: w.id }, data: { wins: { increment: 1 } } });
      await tx.ladderEntry.update({ where: { id: l.id }, data: { losses: { increment: 1 } } });
    }
    await tx.ladderMatch.create({ data: { ladderId, winnerId, loserId, score: score?.slice(0, 40) || null, reportedById: reporterId } });
  });
  return { ok: true as const };
}
