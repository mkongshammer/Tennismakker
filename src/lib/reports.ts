// Money in, by month and by what it was for. Built for the treasurer who
// has to answer "how did we do in October?" and hand numbers to the
// accountant. Every line is a paid transaction with a date, so the CSV
// matches the bank statement.
//
// Wallet top-ups count when the money arrives; bookings paid from the
// wallet do not count again. Court payments are gross; the platform fee is
// shown separately so the club sees what it actually received.
import { db } from "./db";
import { formatDate } from "./international";

export type RevenueLine = {
  date: Date;
  category: "Court bookings" | "Memberships" | "Teams & clinics" | "Punch cards" | "Events" | "Pro shop" | "Gift cards" | "Wallet top-ups";
  description: string;
  customer: string;
  amountKr: number;
  feeKr: number;
  currency: string;
  method: string;
  ref: string;
};

export async function revenueLines(clubId: string, from: Date, to: Date, timeZone = "America/New_York"): Promise<RevenueLine[]> {
  const range = { gte: from, lt: to };
  const lines: RevenueLine[] = [];

  const payments = await db.payment.findMany({
    where: { status: "PAID", createdAt: range, booking: { kind: "COURT", court: { clubId } } },
    include: { booking: { include: { user: { select: { name: true } }, court: { select: { name: true } } } } },
  });
  for (const p of payments) lines.push({ date: p.createdAt, category: "Court bookings", description: `${p.booking.court?.name ?? "Court"} · ${formatDate(p.booking.startsAt, "en-US", timeZone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, customer: p.booking.user.name, amountKr: p.amountKr, feeKr: p.platformFee, currency: p.currency, method: p.provider === "mock" ? "Card (test)" : "Card", ref: p.providerRef ?? p.id });

  const memberships = await db.membership.findMany({
    where: { status: "PAID", paidAt: range, type: { clubId } },
    include: { user: { select: { name: true } }, type: { select: { name: true, seasonName: true, interval: true } } },
  });
  for (const m of memberships) lines.push({ date: m.paidAt!, category: "Memberships", description: `${m.type.name} · ${m.type.seasonName}${m.type.interval === "MONTH" ? " (monthly)" : ""}`, customer: m.user.name, amountKr: m.priceKr, feeKr: 0, currency: m.currency, method: m.paidMethod === "MANUAL" ? "Cash/check" : m.paidMethod === "FREE" ? "Free" : "Card", ref: m.stripeSessionId ?? m.id });
  // Monthly renewals after the first payment.
  const monthly = await db.membership.findMany({ where: { status: "PAID", lastChargeAt: range, type: { clubId, interval: "MONTH" }, NOT: { paidAt: range } }, include: { user: { select: { name: true } }, type: { select: { name: true, seasonName: true } } } });
  for (const m of monthly) if (m.lastChargeAt && m.paidAt && m.lastChargeAt.getTime() !== m.paidAt.getTime()) lines.push({ date: m.lastChargeAt, category: "Memberships", description: `${m.type.name} · ${m.type.seasonName} (monthly)`, customer: m.user.name, amountKr: m.priceKr, feeKr: 0, currency: m.currency, method: "Card", ref: m.id });

  const teams = await db.teamSignup.findMany({ where: { status: "PAID", paidAt: range, team: { clubId } }, include: { user: { select: { name: true } }, team: { select: { name: true } } } });
  for (const t of teams) lines.push({ date: t.paidAt!, category: "Teams & clinics", description: t.team.name, customer: t.user.name, amountKr: t.priceKr, feeKr: 0, currency: t.currency, method: "Card", ref: t.stripeSessionId ?? t.id });

  const punches = await db.clubPunchPurchase.findMany({ where: { status: "PAID", clubId, createdAt: range }, include: { user: { select: { name: true } } } });
  for (const p of punches) lines.push({ date: p.createdAt, category: "Punch cards", description: p.name, customer: p.user.name, amountKr: p.priceKr, feeKr: 0, currency: p.currency, method: "Card", ref: p.id });

  const events = await db.eventSignup.findMany({ where: { status: "PAID", paidAt: range, event: { clubId } }, include: { user: { select: { name: true } }, event: { select: { name: true } } } });
  for (const e of events) lines.push({ date: e.paidAt!, category: "Events", description: e.event.name, customer: e.user.name, amountKr: e.priceKr, feeKr: 0, currency: e.currency, method: "Card", ref: e.stripeSessionId ?? e.id });

  // Wallet sales were paid for when the wallet was topped up, so they don't count again.
  const sales = await db.shopSale.findMany({ where: { clubId, createdAt: range, status: "PAID", method: { not: "WALLET" } } });
  for (const s of sales) {
    const items = JSON.parse(s.items) as { name: string; qty: number }[];
    lines.push({ date: s.createdAt, category: "Pro shop", description: items.map((i) => `${i.qty}× ${i.name}`).join(", "), customer: "", amountKr: s.totalKr, feeKr: 0, currency: s.currency, method: s.method === "CASH" ? "Cash" : s.method === "READER" ? "Card (reader)" : "Card (desk)", ref: s.id });
  }

  const gifts = await db.giftCard.findMany({ where: { clubId, paidAt: range, status: { in: ["ACTIVE", "REDEEMED"] } } });
  for (const g of gifts) lines.push({ date: g.paidAt!, category: "Gift cards", description: `Gift card ${g.code}`, customer: g.recipientName ?? "", amountKr: g.amountKr, feeKr: 0, currency: g.currency, method: "Card", ref: g.stripeSessionId ?? g.id });

  const topups = await db.walletTopup.findMany({ where: { clubId, status: "PAID", createdAt: range } });
  const names = new Map((await db.user.findMany({ where: { id: { in: topups.map((t) => t.userId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  for (const t of topups) lines.push({ date: t.createdAt, category: "Wallet top-ups", description: `Wallet credit ${(t.creditOre / 100).toFixed(2)}`, customer: names.get(t.userId) ?? "", amountKr: Math.round(t.paidOre / 100), feeKr: 0, currency: t.currency, method: "Card", ref: t.sessionId ?? t.id });

  return lines.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const CATEGORIES: RevenueLine["category"][] = ["Court bookings", "Memberships", "Teams & clinics", "Punch cards", "Events", "Pro shop", "Gift cards", "Wallet top-ups"];

export function monthKey(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export function summarize(lines: RevenueLine[], timeZone: string) {
  const months = new Map<string, { total: number; fees: number; byCategory: Record<string, number>; count: number }>();
  for (const l of lines) {
    const k = monthKey(l.date, timeZone);
    const m = months.get(k) ?? { total: 0, fees: 0, byCategory: {}, count: 0 };
    m.total += l.amountKr; m.fees += l.feeKr; m.count++;
    m.byCategory[l.category] = (m.byCategory[l.category] ?? 0) + l.amountKr;
    months.set(k, m);
  }
  return [...months.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([month, v]) => ({ month, ...v }));
}

const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const localDate = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export function toCsv(lines: RevenueLine[], timeZone: string) {
  const head = ["Date", "Category", "Description", "Customer", "Amount", "Platform fee", "Net", "Currency", "Method", "Reference"];
  const rows = lines.map((l) => [localDate(l.date, timeZone), l.category, l.description, l.customer, l.amountKr, l.feeKr, l.amountKr - l.feeKr, l.currency, l.method, l.ref]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/**
 * QuickBooks Online "3-column" bank-style import: Date, Description, Amount.
 * Positive amounts are deposits; the fee line is negative so the net is
 * right. Category goes in the description so rules can file it.
 */
export function toQuickBooksCsv(lines: RevenueLine[], timeZone: string) {
  const rows: (string | number)[][] = [["Date", "Description", "Amount"]];
  for (const l of lines) {
    rows.push([localDate(l.date, timeZone), `${l.category}: ${l.description}${l.customer ? ` (${l.customer})` : ""}`, l.amountKr]);
    if (l.feeKr) rows.push([localDate(l.date, timeZone), `RacketBuddy fee: ${l.description}`, -l.feeKr]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
