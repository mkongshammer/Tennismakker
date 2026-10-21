// Front-desk register and gift cards.
//
// The register records what was sold and how it was paid (cash, card at the
// desk, or the member's club wallet). It is a record for the books, not a
// card terminal: card payments at the desk are taken on the club's own
// reader. Wallet payments do move money: the member's balance is debited.
//
// Gift cards are bought online with Stripe (to the club's account) and
// redeemed into the recipient's club wallet, which already pays for courts.
import crypto from "node:crypto";
import { validateOrderCheckout, type CheckoutEvidence } from "./payment-validation";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { dataRegionForCountry } from "./region";
import { sendMail } from "./email";

export type SaleLine = { itemId: string; qty: number };

export async function recordSale(clubId: string, soldById: string, lines: SaleLine[], method: "CASH" | "CARD" | "WALLET", userId: string | null) {
  const items = await db.shopItem.findMany({ where: { clubId, id: { in: lines.map((l) => l.itemId) }, active: true } });
  const rows = lines.map((l) => ({ item: items.find((i) => i.id === l.itemId)!, qty: Math.max(1, Math.min(99, Math.floor(l.qty))) })).filter((r) => r.item);
  if (!rows.length) throw Error("Vælg mindst én vare.");
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { currency: true } });
  const totalKr = rows.reduce((s, r) => s + r.item.priceKr * r.qty, 0);
  if (method === "WALLET") {
    if (!userId) throw Error("Vælg medlemmet, hvis wallet der skal trækkes på.");
    const wallet = await db.clubWallet.findUnique({ where: { userId_clubId: { userId, clubId } } });
    if (!wallet || wallet.frozen) throw Error("Medlemmet har ingen aktiv wallet i klubben.");
    if (wallet.balanceOre < totalKr * 100) throw Error("Der er ikke nok på medlemmets wallet.");
  }
  return db.$transaction(async (tx) => {
    const sale = await tx.shopSale.create({ data: { clubId, userId, soldById, method, totalKr, currency: club.currency, items: JSON.stringify(rows.map((r) => ({ name: r.item.name, priceKr: r.item.priceKr, qty: r.qty }))) } });
    for (const r of rows) if (r.item.stock >= 0) await tx.shopItem.update({ where: { id: r.item.id }, data: { stock: { decrement: r.qty } } });
    if (method === "WALLET" && userId) {
      const wallet = await tx.clubWallet.findUniqueOrThrow({ where: { userId_clubId: { userId, clubId } } });
      await tx.clubWallet.update({ where: { id: wallet.id }, data: { balanceOre: { decrement: totalKr * 100 } } });
      await tx.walletEntry.create({ data: { walletId: wallet.id, eventKey: `sale:${sale.id}`, amountOre: -totalKr * 100, label: `Pro shop: ${rows.map((r) => `${r.qty}× ${r.item.name}`).join(", ")}` } });
    }
    return sale;
  });
}

// ---------- Gift cards ----------

const newCode = () => "RB-" + crypto.randomBytes(4).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");

export type GiftResult = { ok: true; checkoutUrl: string | null; code?: string } | { ok: false; error: string };

export async function buyGiftCard(buyerId: string | null, clubId: string, amountKr: number, recipient: { email?: string; name?: string; message?: string }): Promise<GiftResult> {
  const club = await db.club.findUnique({ where: { id: clubId }, select: { id: true, name: true, slug: true, currency: true, country: true, stripeAccountId: true, stripeChargesEnabled: true, walletEnabled: true } });
  if (!club) return { ok: false, error: "Club not found." };
  if (!Number.isInteger(amountKr) || amountKr < 10 || amountKr > 1000) return { ok: false, error: "Choose an amount between 10 and 1000." };
  const settings = await getSettings();
  if (settings.paymentProvider === "stripe" && (!club.stripeAccountId || !club.stripeChargesEnabled)) return { ok: false, error: "The club can't take payments yet." };
  const card = await db.giftCard.create({ data: { clubId, code: newCode(), amountKr, currency: club.currency, buyerId, recipientEmail: recipient.email?.toLowerCase() || null, recipientName: recipient.name || null, message: recipient.message?.slice(0, 300) || null } });
  if (settings.paymentProvider !== "stripe") { await confirmGiftCard(card.id); return { ok: true, checkoutUrl: null, code: card.code }; }
  const region = dataRegionForCountry(club.country);
  const session = await (await stripe()).checkout.sessions.create({
    adaptive_pricing: { enabled: false }, mode: "payment",
    payment_intent_data: { transfer_data: { destination: club.stripeAccountId! }, metadata: { giftCardId: card.id, region } },
    line_items: [{ price_data: { currency: club.currency.toLowerCase(), product_data: { name: `Gift card · ${club.name}`, description: `${amountKr} ${club.currency} towards courts, lessons and more` }, unit_amount: amountKr * 100 }, quantity: 1 }],
    metadata: { giftCardId: card.id, region },
    success_url: `${settings.appUrl}/clubs/${club.slug}/gift?paid=${card.id}`, cancel_url: `${settings.appUrl}/clubs/${club.slug}/gift`,
  });
  await db.giftCard.update({ where: { id: card.id }, data: { stripeSessionId: session.id } });
  if (!session.url) return { ok: false, error: "The payment page couldn't be opened." };
  return { ok: true, checkoutUrl: session.url };
}

export async function confirmGiftCard(id: string, session?: CheckoutEvidence) {
  if (session) { const card = await db.giftCard.findUniqueOrThrow({ where: { id } }); validateOrderCheckout({ id: card.id, priceKr: card.amountKr, currency: card.currency }, session, "giftCardId"); }
  const r = await db.giftCard.updateMany({ where: { id, status: "PENDING" }, data: { status: "ACTIVE", paidAt: new Date() } });
  if (!r.count) return;
  const card = await db.giftCard.findUniqueOrThrow({ where: { id }, include: { club: { select: { name: true, slug: true } } } });
  const buyer = card.buyerId ? await db.user.findUnique({ where: { id: card.buyerId }, select: { email: true, name: true } }) : null;
  const { settingsSnapshot } = await import("./settings");
  const redeem = `${settingsSnapshot().appUrl}/clubs/${card.club.slug}/gift?code=${card.code}`;
  const body = [`A ${card.amountKr} ${card.currency} gift card for ${card.club.name}.`, "", `Code: ${card.code}`, card.message ? `\n"${card.message}"${buyer ? ` — ${buyer.name}` : ""}` : "", "", `Redeem it here (it goes into your club wallet and pays for courts and more):`, redeem].join("\n");
  if (card.recipientEmail) await sendMail({ to: card.recipientEmail, subject: `${buyer?.name ?? "Someone"} sent you a gift card for ${card.club.name}`, body: `Hi ${card.recipientName ?? ""}\n\n${body}` }).catch(() => {});
  if (buyer) await sendMail({ to: buyer.email, subject: `Your gift card for ${card.club.name}`, body: `Hi ${buyer.name}\n\nThanks for your purchase. ${card.recipientEmail ? `We've e-mailed the card to ${card.recipientEmail}. ` : ""}Here it is for your records:\n\n${body}\n\nThis e-mail is your receipt.` }).catch(() => {});
}

export async function redeemGiftCard(userId: string, code: string) {
  const card = await db.giftCard.findUnique({ where: { code: code.trim().toUpperCase() }, include: { club: { select: { id: true, currency: true } } } });
  if (!card) return { ok: false as const, error: "That code doesn't match a gift card." };
  if (card.status === "REDEEMED") return { ok: false as const, error: "This gift card has already been redeemed." };
  if (card.status !== "ACTIVE") return { ok: false as const, error: "This gift card isn't active." };
  await db.$transaction(async (tx) => {
    const wallet = await tx.clubWallet.upsert({ where: { userId_clubId: { userId, clubId: card.clubId } }, create: { userId, clubId: card.clubId, currency: card.club.currency, balanceOre: 0 }, update: {} });
    await tx.clubWallet.update({ where: { id: wallet.id }, data: { balanceOre: { increment: card.amountKr * 100 } } });
    await tx.walletEntry.create({ data: { walletId: wallet.id, eventKey: `gift:${card.id}`, amountOre: card.amountKr * 100, label: `Gift card ${card.code}` } });
    await tx.giftCard.update({ where: { id: card.id }, data: { status: "REDEEMED", redeemedById: userId, redeemedAt: new Date() } });
  });
  // A member who redeems a club's card belongs to that club's wallet; keep their club link if they have none.
  await db.user.updateMany({ where: { id: userId, clubId: null, role: "PLAYER" }, data: { clubId: card.clubId } });
  return { ok: true as const, amountKr: card.amountKr };
}
