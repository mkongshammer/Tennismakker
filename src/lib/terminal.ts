// Stripe Terminal at the front desk. The reader is registered to the club's
// own Stripe account, the sale is rung up in the register, the amount is
// pushed to the reader, the customer taps, and the register sees the sale
// go through. Money lands in the club's account directly (a direct charge
// on the connected account), with no platform fee on shop sales.
//
// With PAYMENT_PROVIDER=mock (local), a pretend reader approves every
// payment three seconds after it is started, so the whole flow can be
// exercised without hardware.
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";

const MOCK_READER = "tmr_mock_desk";

async function mode() { return (await getSettings()).paymentProvider === "stripe" ? "stripe" : "mock"; }

async function connected(clubId: string) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { id: true, name: true, address: true, city: true, country: true, currency: true, stripeAccountId: true, stripeChargesEnabled: true } });
  if ((await mode()) === "stripe" && (!club.stripeAccountId || !club.stripeChargesEnabled)) throw Error("The club's Stripe account isn't ready to take payments yet. Finish Stripe onboarding under Payments first.");
  return club;
}

/** Pair a reader using the code it shows on screen (e.g. "sepia-cerulean-orynx"). */
export async function registerReader(clubId: string, registrationCode: string, label: string, postalCode: string, state: string) {
  const club = await connected(clubId);
  if ((await mode()) === "mock") {
    return db.clubReader.upsert({ where: { stripeReaderId: MOCK_READER }, create: { clubId, stripeReaderId: MOCK_READER, locationId: "tml_mock", label: label || "Desk reader (test)", deviceType: "simulated" }, update: { label: label || "Desk reader (test)" } });
  }
  const s = await stripe();
  const opts = { stripeAccount: club.stripeAccountId! };
  // One location per club; reuse it if a reader was registered before.
  const existing = await db.clubReader.findFirst({ where: { clubId }, select: { locationId: true } });
  const locationId = existing?.locationId ?? (await s.terminal.locations.create({ display_name: club.name, address: { line1: club.address ?? club.name, city: club.city, state: state || undefined, postal_code: postalCode || undefined, country: club.country } }, opts)).id;
  const reader = await s.terminal.readers.create({ registration_code: registrationCode.trim().toLowerCase(), label: label || `${club.name} desk`, location: locationId }, opts);
  return db.clubReader.create({ data: { clubId, stripeReaderId: reader.id, locationId, label: reader.label ?? label, deviceType: reader.device_type } });
}

export async function removeReader(clubId: string, id: string) {
  const r = await db.clubReader.findFirst({ where: { id, clubId } });
  if (!r) return;
  if ((await mode()) === "stripe") { const club = await connected(clubId); await (await stripe()).terminal.readers.del(r.stripeReaderId, { stripeAccount: club.stripeAccountId! }).catch(() => {}); }
  await db.clubReader.delete({ where: { id: r.id } });
}

/** Readers with their live status, for the register. */
export async function readersWithStatus(clubId: string) {
  const readers = await db.clubReader.findMany({ where: { clubId }, orderBy: { createdAt: "asc" } });
  if (!readers.length) return [];
  if ((await mode()) === "mock") return readers.map((r) => ({ ...r, status: "online" as string, action: null as string | null }));
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { stripeAccountId: true } });
  const s = await stripe();
  const out = [];
  for (const r of readers) {
    const live = await s.terminal.readers.retrieve(r.stripeReaderId, {}, { stripeAccount: club.stripeAccountId! }).catch(() => null);
    const reader = live && !("deleted" in live && live.deleted) ? live : null;
    out.push({ ...r, status: reader?.status ?? "unknown", action: reader?.action?.type ?? null });
  }
  return out;
}

/** Push a pending sale's amount to the reader. The sale row already exists with status PENDING. */
export async function startReaderPayment(clubId: string, saleId: string, readerId: string) {
  const [club, sale, reader] = await Promise.all([connected(clubId), db.shopSale.findFirstOrThrow({ where: { id: saleId, clubId } }), db.clubReader.findFirstOrThrow({ where: { id: readerId, clubId } })]);
  if ((await mode()) === "mock") {
    await db.shopSale.update({ where: { id: sale.id }, data: { paymentIntentId: `pi_mock_${sale.id}`, readerId: reader.id } });
    return { paymentIntentId: `pi_mock_${sale.id}` };
  }
  const s = await stripe();
  const opts = { stripeAccount: club.stripeAccountId! };
  const pi = await s.paymentIntents.create({ amount: sale.totalKr * 100, currency: club.currency.toLowerCase(), payment_method_types: ["card_present"], capture_method: "automatic", description: `Pro shop · ${club.name}`, metadata: { shopSaleId: sale.id, clubId, region: "US" } }, opts);
  await db.shopSale.update({ where: { id: sale.id }, data: { paymentIntentId: pi.id, readerId: reader.id } });
  await s.terminal.readers.processPaymentIntent(reader.stripeReaderId, { payment_intent: pi.id }, opts);
  return { paymentIntentId: pi.id };
}

/** Where a pending sale stands. Polled by the register; marks the sale paid when the card went through. */
export async function readerSaleStatus(clubId: string, saleId: string): Promise<{ status: "PENDING" | "PAID" | "CANCELLED" | "FAILED"; detail?: string }> {
  const sale = await db.shopSale.findFirst({ where: { id: saleId, clubId } });
  if (!sale) return { status: "FAILED", detail: "Sale not found" };
  if (sale.status !== "PENDING") return { status: sale.status as "PAID" | "CANCELLED" | "FAILED" };
  if (!sale.paymentIntentId) return { status: "PENDING" };
  if ((await mode()) === "mock") {
    if (Date.now() - sale.createdAt.getTime() > 3000) { await confirmReaderSale(sale.id); return { status: "PAID" }; }
    return { status: "PENDING", detail: "Waiting for the card" };
  }
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { stripeAccountId: true } });
  const pi = await (await stripe()).paymentIntents.retrieve(sale.paymentIntentId, {}, { stripeAccount: club.stripeAccountId! });
  if (pi.status === "succeeded") { await confirmReaderSale(sale.id); return { status: "PAID" }; }
  if (pi.status === "canceled") { await failReaderSale(sale.id, "CANCELLED"); return { status: "CANCELLED" }; }
  if (pi.last_payment_error) return { status: "PENDING", detail: pi.last_payment_error.message ?? "Card declined, try again" };
  return { status: "PENDING", detail: pi.status === "requires_payment_method" ? "Waiting for the card" : pi.status };
}

/** The customer tapped and Stripe approved. Called from polling or the webhook; safe to call twice. */
export async function confirmReaderSale(saleId: string) {
  await db.shopSale.updateMany({ where: { id: saleId, status: "PENDING" }, data: { status: "PAID" } });
}

/** Give the stock back and close the sale. */
export async function failReaderSale(saleId: string, status: "CANCELLED" | "FAILED") {
  const sale = await db.shopSale.findUnique({ where: { id: saleId } });
  if (!sale || sale.status !== "PENDING") return;
  const items = JSON.parse(sale.items) as { name: string; qty: number; itemId?: string }[];
  await db.$transaction(async (tx) => {
    await tx.shopSale.update({ where: { id: sale.id }, data: { status } });
    for (const i of items) if (i.itemId) await tx.shopItem.updateMany({ where: { id: i.itemId, stock: { gte: 0 } }, data: { stock: { increment: i.qty } } });
  });
}

/** The desk gives up (customer walked away, wrong amount): stop the reader, cancel the intent, release the stock. */
export async function cancelReaderSale(clubId: string, saleId: string) {
  const sale = await db.shopSale.findFirst({ where: { id: saleId, clubId } });
  if (!sale || sale.status !== "PENDING") return;
  if ((await mode()) === "stripe" && sale.paymentIntentId) {
    const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { stripeAccountId: true } });
    const s = await stripe(); const opts = { stripeAccount: club.stripeAccountId! };
    const reader = sale.readerId ? await db.clubReader.findUnique({ where: { id: sale.readerId } }) : null;
    if (reader) await s.terminal.readers.cancelAction(reader.stripeReaderId, {}, opts).catch(() => {});
    await s.paymentIntents.cancel(sale.paymentIntentId, undefined, opts).catch(() => {});
  }
  await failReaderSale(saleId, "CANCELLED");
}

/**
 * Reader sales are direct charges on the club's own Stripe account, so they
 * never reach the platform webhook. The register polls while it is open;
 * this sweep settles any sale the desk walked away from (tab closed, laptop
 * asleep): paid ones become PAID, ones still unpaid after 15 minutes are
 * cancelled and their stock is released.
 */
export async function sweepReaderSales() {
  const pending = await db.shopSale.findMany({ where: { method: "READER", status: "PENDING", createdAt: { lt: new Date(Date.now() - 60_000) } }, select: { id: true, clubId: true, createdAt: true }, take: 50 });
  let paid = 0, cancelled = 0;
  for (const s of pending) {
    const r = await readerSaleStatus(s.clubId, s.id).catch(() => ({ status: "PENDING" as const }));
    if (r.status === "PAID") paid++;
    else if (r.status === "PENDING" && Date.now() - s.createdAt.getTime() > 15 * 60_000) { await cancelReaderSale(s.clubId, s.id).catch(() => {}); cancelled++; }
  }
  return { checked: pending.length, paid, cancelled };
}
