import type Stripe from "stripe";
import { db } from "./db";
import { stripe } from "./stripe";

type CheckoutBooking = { id: string; checkoutParams: string | null; checkoutSessionId: string | null };

/** Reuse the one durable attempt. Never rotate keys after an uncertain result. */
export async function resumeBookingCheckout(booking: CheckoutBooking): Promise<string> {
  if (!booking.checkoutParams) throw new Error("Betalingen er ikke klargjort.");
  const params = JSON.parse(booking.checkoutParams) as Stripe.Checkout.SessionCreateParams;
  const client = await stripe();
  let session: Stripe.Checkout.Session;
  if (booking.checkoutSessionId) {
    session = await client.checkout.sessions.retrieve(booking.checkoutSessionId);
  } else {
    // Stripe retains idempotency keys for at least 24h. Only replay within the
    // original checkout window; an old key must never create a second session.
    if (!params.expires_at || params.expires_at * 1000 <= Date.now()) {
      throw new Error("Betalingens status skal kontrolleres. Kontakt support før en ny booking.");
    }
    session = await client.checkout.sessions.create(params, {
      idempotencyKey: `booking-checkout-v1-${booking.id}`,
      timeout: 15000,
    });
    await db.booking.update({ where: { id: booking.id }, data: { checkoutSessionId: session.id } });
  }
  if (session.status !== "open" || !session.url) {
    throw new Error("Betalingen er afsluttet eller behandles allerede. Se status under Min profil.");
  }
  return session.url;
}

export async function prepareBookingCheckout(bookingId: string, params: Stripe.Checkout.SessionCreateParams) {
  const now = new Date();
  if (!params.expires_at) throw new Error("Betalingen mangler en frist.");
  // Conditional update locks the booking row. Cancellation and expiry use the
  // same condition, so a stale read cannot release a newly prepared checkout.
  await db.booking.updateMany({
    where: { id: bookingId, status: "HOLD", checkoutParams: null,
      OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
    data: { checkoutParams: JSON.stringify(params), holdExpiresAt: new Date(params.expires_at * 1000) },
  });
  const current = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (current.status !== "HOLD" || !current.checkoutParams) throw new Error("Reservationen er ikke længere aktiv.");
  return resumeBookingCheckout(current);
}

/** Prove Checkout cannot accept payment before releasing a reserved time. */
export async function closeBookingCheckout(booking: CheckoutBooking): Promise<void> {
  if (!booking.checkoutParams) return;
  if (!booking.checkoutSessionId) {
    throw new Error("Betalingens status er endnu ukendt. Prøv igen senere eller kontakt support.");
  }
  const client = await stripe();
  let session = await client.checkout.sessions.retrieve(booking.checkoutSessionId);
  if (session.status === "open") {
    // If payment wins this race, expire rejects and the booking stays held.
    session = await client.checkout.sessions.expire(session.id);
  }
  if (session.status !== "expired" || session.payment_status !== "unpaid") {
    throw new Error("Betalingen er gennemført eller behandles. Opdatér Min profil før aflysning.");
  }
}
