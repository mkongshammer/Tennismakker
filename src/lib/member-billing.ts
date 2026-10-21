// Membership billing: the club sends the bill, the member pays it.
//
// Self-signup (src/lib/memberships.ts) covers members who come to the club
// page and join. Most clubs that move to RacketBuddy already have a member
// list, though, and they need to bill all of it at the start of a season.
// So the club picks a membership, we create one open bill per member,
// e-mail each a pay link, and remind them before and after the due date.
//
// A bill is a Membership row in status PENDING with billedAt set. The pay
// link carries a random token instead of requiring a login: imported members
// have never chosen a password, and a bill nobody can open goes unpaid.
// Paying goes through the same Stripe checkout and webhook as self-signup,
// so the money lands in the club's own Stripe account.
import crypto from "node:crypto";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { confirmMembership } from "./memberships";
import { dataRegionForCountry } from "./region";
import { billNotice, billReminder, sendMail } from "./email";

export const REMINDER_BEFORE_DAYS = 3;
export const REMINDER_AFTER_DAYS = 3;
const DAY = 86_400_000;

export type BillStatus = "PAID" | "OPEN" | "OVERDUE" | "CANCELLED";

export function billStatus(m: { status: string; dueDate: Date | null }, now = new Date()): BillStatus {
  if (m.status === "PAID") return "PAID";
  if (m.status === "CANCELLED") return "CANCELLED";
  return m.dueDate && m.dueDate.getTime() < now.getTime() ? "OVERDUE" : "OPEN";
}

const newToken = () => crypto.randomBytes(24).toString("base64url");

/** Members of the club who have no paid or open bill for this membership. */
export async function unbilledMembers(clubId: string, typeId: string) {
  return db.user.findMany({
    where: {
      clubId,
      role: { in: ["PLAYER", "COACH"] },
      email: { not: { endsWith: "@deleted.racketbuddy.invalid" } },
      memberships: { none: { typeId, OR: [{ status: "PAID" }, { status: "PENDING", billedAt: { not: null } }] } },
    },
    select: { id: true, name: true, email: true, locale: true },
    orderBy: { name: "asc" },
  });
}

async function clubType(clubId: string, typeId: string) {
  const type = await db.membershipType.findFirst({
    where: { id: typeId, clubId },
    include: { club: true },
  });
  if (!type) throw Error("Kontingentet findes ikke.");
  if (type.toDate < new Date()) throw Error("Sæsonen er slut. Opret en ny sæson først.");
  return type;
}

function dueDateFor(days: number) {
  const d = new Date(Date.now() + Math.max(1, Math.min(90, days)) * DAY);
  d.setUTCHours(23, 59, 0, 0);
  return d;
}

async function mailBill(membershipId: string, kind: "notice" | "before" | "after") {
  const m = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: true, type: { include: { club: true } } },
  });
  if (!m || !m.payToken || m.status !== "PENDING") return false;
  const club = m.type.club;
  const opts = {
    to: m.user.email,
    name: m.user.name,
    locale: m.user.locale,
    timeZone: club.timeZone,
    clubName: club.name,
    typeName: m.type.name,
    seasonName: m.type.seasonName,
    fromDate: m.type.fromDate,
    toDate: m.type.toDate,
    priceKr: m.priceKr,
    currency: m.currency,
    dueDate: m.dueDate,
    payToken: m.payToken,
    note: club.billingNote,
    replyTo: club.billingReplyTo || club.contactEmail || undefined,
  };
  return sendMail(kind === "notice" ? billNotice(opts) : billReminder({ ...opts, overdue: kind === "after" }));
}

/**
 * Bills members for a membership. Members who already paid, or already
 * have an open bill, are skipped, so sending twice never double-bills.
 */
export async function sendBills(clubId: string, typeId: string, userIds?: string[]) {
  const type = await clubType(clubId, typeId);
  let targets = await unbilledMembers(clubId, typeId);
  if (userIds) targets = targets.filter((u) => userIds.includes(u.id));
  const dueDate = dueDateFor(type.club.billingDueDays);
  let sent = 0;
  for (const u of targets) {
    const data = {
      priceKr: type.priceKr,
      currency: type.club.currency,
      status: "PENDING",
      billedAt: new Date(),
      dueDate,
      payToken: newToken(),
      remindersSent: 0,
      lastReminderAt: null,
      paidMethod: null,
    };
    const m = await db.membership.upsert({
      where: { typeId_userId: { typeId, userId: u.id } },
      create: { typeId, userId: u.id, ...data },
      update: data,
    });
    if (type.priceKr <= 0) {
      await confirmMembership(m.id);
      await db.membership.update({ where: { id: m.id }, data: { paidMethod: "FREE" } });
      continue;
    }
    await mailBill(m.id, "notice");
    sent++;
  }
  return { sent, total: targets.length };
}

async function clubBill(clubId: string, membershipId: string) {
  const m = await db.membership.findFirst({ where: { id: membershipId, type: { clubId } } });
  if (!m) throw Error("Regningen findes ikke.");
  return m;
}

export async function resendBill(clubId: string, membershipId: string) {
  const m = await clubBill(clubId, membershipId);
  if (m.status !== "PENDING" || !m.billedAt) throw Error("Kun åbne regninger kan sendes igen.");
  await mailBill(m.id, billStatus(m) === "OVERDUE" ? "after" : "notice");
  await db.membership.update({ where: { id: m.id }, data: { lastReminderAt: new Date() } });
}

/** Paid outside RacketBuddy: cash, check or bank transfer. */
export async function markBillPaid(clubId: string, membershipId: string) {
  const m = await clubBill(clubId, membershipId);
  if (m.status === "PAID") return;
  if (m.status !== "PENDING") throw Error("Regningen er annulleret.");
  await confirmMembership(m.id);
  await db.membership.update({ where: { id: m.id }, data: { paidMethod: "MANUAL" } });
}

export async function cancelBill(clubId: string, membershipId: string) {
  const m = await clubBill(clubId, membershipId);
  if (m.status !== "PENDING") throw Error("Kun åbne regninger kan annulleres.");
  await db.membership.update({ where: { id: m.id }, data: { status: "CANCELLED", payToken: null } });
}

export async function billByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.membership.findFirst({
    where: { payToken: token },
    include: { user: { select: { id: true, name: true } }, type: { include: { club: true } } },
  });
}

export type PayResult = { ok: true; checkoutUrl: string | null } | { ok: false; error: string };

/** Starts Stripe checkout for an open bill (or confirms it in mock mode). */
export async function payBill(membershipId: string): Promise<PayResult> {
  const m = await db.membership.findUnique({
    where: { id: membershipId },
    include: { type: { include: { club: true } } },
  });
  if (!m) return { ok: false, error: "Regningen findes ikke." };
  if (m.status === "PAID") return { ok: true, checkoutUrl: null };
  if (m.status !== "PENDING" || !m.payToken) return { ok: false, error: "Regningen er annulleret. Kontakt klubben." };
  const club = m.type.club;
  const settings = await getSettings();
  if (m.priceKr <= 0 || settings.paymentProvider !== "stripe") {
    await confirmMembership(m.id);
    await db.membership.update({ where: { id: m.id }, data: { paidMethod: m.priceKr <= 0 ? "FREE" : "CARD" } });
    return { ok: true, checkoutUrl: null };
  }
  if (!club.stripeAccountId || !club.stripeChargesEnabled) {
    return { ok: false, error: "Klubben kan ikke tage imod betaling endnu. Kontakt klubben." };
  }
  const region = dataRegionForCountry(club.country);
  const back = `${settings.appUrl}/pay/${m.payToken}`;
  const session = await (await stripe()).checkout.sessions.create({
    adaptive_pricing: { enabled: false },
    mode: "payment",
    payment_intent_data: { transfer_data: { destination: club.stripeAccountId }, metadata: { membershipId: m.id, region } },
    line_items: [{
      price_data: {
        currency: m.currency.toLowerCase(),
        product_data: { name: `${m.type.name} — ${m.type.seasonName}`, description: club.name },
        unit_amount: m.priceKr * 100,
      },
      quantity: 1,
    }],
    metadata: { membershipId: m.id, region },
    success_url: `${back}?paid=1`,
    cancel_url: back,
  });
  await db.membership.update({ where: { id: m.id }, data: { stripeSessionId: session.id, paidMethod: "CARD" } });
  if (!session.url) return { ok: false, error: "Betalingssiden kunne ikke åbnes. Prøv igen." };
  return { ok: true, checkoutUrl: session.url };
}

/** Open and recent bills for a member, across clubs, for web and app. */
export async function memberBills(userId: string) {
  const rows = await db.membership.findMany({
    where: {
      userId,
      OR: [
        { status: "PENDING", payToken: { not: null } },
        { status: "PAID", type: { toDate: { gte: new Date() } } },
      ],
    },
    include: { type: { include: { club: { select: { name: true, slug: true, timeZone: true } } } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    token: m.payToken,
    status: billStatus(m),
    clubName: m.type.club.name,
    clubSlug: m.type.club.slug,
    timeZone: m.type.club.timeZone,
    typeName: m.type.name,
    seasonName: m.type.seasonName,
    fromDate: m.type.fromDate,
    toDate: m.type.toDate,
    amount: m.priceKr,
    currency: m.currency,
    dueDate: m.dueDate,
    paidAt: m.paidAt,
  }));
}

/**
 * Reminders, run from the scheduled sync job: one a few days before the
 * due date and one a few days after it. Never more than two.
 */
export async function runBillReminders() {
  const now = Date.now();
  const open = await db.membership.findMany({
    where: {
      status: "PENDING",
      billedAt: { not: null },
      dueDate: { not: null },
      payToken: { not: null },
      remindersSent: { lt: 2 },
      type: { toDate: { gte: new Date() }, club: { billingReminders: true } },
    },
    select: { id: true, dueDate: true, remindersSent: true, billedAt: true },
    take: 500,
  });
  let sent = 0;
  for (const m of open) {
    const due = m.dueDate!.getTime();
    let kind: "before" | "after" | null = null;
    if (m.remindersSent === 0 && due - now <= REMINDER_BEFORE_DAYS * DAY && due > now && now - m.billedAt!.getTime() > 2 * DAY) kind = "before";
    else if (now - due >= REMINDER_AFTER_DAYS * DAY) kind = "after";
    if (!kind) continue;
    await mailBill(m.id, kind);
    await db.membership.update({
      where: { id: m.id },
      data: { remindersSent: kind === "after" ? 2 : 1, lastReminderAt: new Date() },
    });
    sent++;
  }
  return { sent };
}

/** Everything the admin billing panel shows for one club. */
export async function clubBillingOverview(clubId: string) {
  const types = await db.membershipType.findMany({
    where: { clubId },
    orderBy: [{ toDate: "desc" }, { sortOrder: "asc" }],
    take: 12,
  });
  const members = await db.user.count({ where: { clubId, role: { in: ["PLAYER", "COACH"] } } });
  const out = [];
  for (const t of types) {
    const bills = await db.membership.findMany({
      where: { typeId: t.id, OR: [{ status: "PAID" }, { status: "PENDING", billedAt: { not: null } }] },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });
    const unbilled = t.toDate >= new Date() ? (await unbilledMembers(clubId, t.id)).length : 0;
    out.push({
      id: t.id,
      name: t.name,
      seasonName: t.seasonName,
      priceKr: t.priceKr,
      open: t.toDate >= new Date(),
      unbilled,
      bills: bills.map((b) => ({
        id: b.id,
        name: b.user.name,
        email: b.user.email,
        amount: b.priceKr,
        status: billStatus(b),
        billed: Boolean(b.billedAt),
        dueDate: b.dueDate,
        paidAt: b.paidAt,
        paidMethod: b.paidMethod,
      })),
    });
  }
  return { members, types: out };
}
