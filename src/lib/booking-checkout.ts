import type Stripe from "stripe";
import { db } from "./db";
import { stripe } from "./stripe";
import { dataRegionForCountry } from "./region";

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

  const booking = await db.booking.findUnique({
    where:{id:bookingId},
    include:{user:true,court:{include:{club:true}},coachProfile:true},
  });
  if(!booking)throw new Error("Booking findes ikke");
  const country=booking.kind==='COURT'?booking.court?.club.country:booking.coachProfile?.country??booking.user.country;
  const region=dataRegionForCountry(country);
  const regionalParams:Stripe.Checkout.SessionCreateParams={
    ...params,
    adaptive_pricing:{enabled:false},
    metadata:{...(params.metadata??{}),region},
    ...(params.payment_intent_data?{
      payment_intent_data:{
        ...params.payment_intent_data,
        metadata:{...(params.payment_intent_data.metadata??{}),region},
      },
    }:{}),
  };

  await db.booking.updateMany({
    where: { id: bookingId, status: "HOLD", checkoutParams: null,
      OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
    data: { checkoutParams: JSON.stringify(regionalParams), holdExpiresAt: new Date(params.expires_at * 1000) },
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
    session = await client.checkout.sessions.expire(session.id);
  }
  if (session.status !== "expired" || session.payment_status !== "unpaid") {
    throw new Error("Betalingen er gennemført eller behandles. Opdatér Min profil før aflysning.");
  }
}
