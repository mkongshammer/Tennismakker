// Betalingslag for Tennis Makker.
//
// Arkitektur-princip (vigtigt, jf. forretningsplanen):
// Penge skal kunne splittes mellem klub/træner og platformen (kommission).
// Derfor er laget bygget som en "marketplace"-abstraktion fra dag ét, så
// Stripe Connect (eller en dansk PSP med split payment) kan sættes ind
// uden at røre resten af koden.
//
// I udvikling bruges MockProvider: betalinger markeres som betalt med det
// samme, men hele flowet (hold -> checkout -> bekræftelse -> udbetalingssplit)
// er identisk med produktion.
//
// Produktion med Stripe (skitse):
// 1. Opret Stripe-konto + aktiver Stripe Connect (Express-konti til klubber/trænere).
// 2. Ved checkout: opret PaymentIntent med `application_fee_amount` = platformFee
//    og `transfer_data.destination` = klubbens/trænerens Connect-konto.
//    MobilePay slås til som payment method i Stripe Dashboard.
// 3. Webhook (payment_intent.succeeded) kalder confirmBookingPayment() nedenfor.

import { db } from "./db";

// Platformens andel af hver transaktion
const COURT_FEE_PCT = 0.03; // 3% af banebooking går til platformen
const COACH_FEE_PCT = 0.12; // 12% kommission på trænertimer

export function platformFee(kind: "COURT" | "COACH", amountKr: number): number {
  const pct = kind === "COURT" ? COURT_FEE_PCT : COACH_FEE_PCT;
  return Math.round(amountKr * pct);
}

/**
 * Starter en betaling for en booking der er i HOLD-status.
 * Returnerer en checkout-URL som brugeren sendes til.
 */
export async function startCheckout(bookingId: string): Promise<string> {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";

  if (provider === "stripe") {
    // TODO (produktion): opret Stripe Checkout Session / PaymentIntent her
    // og returnér session.url. Se skitsen øverst i filen.
    throw new Error(
      "Stripe er ikke konfigureret endnu. Sæt PAYMENT_PROVIDER=mock i .env, eller implementér Stripe i src/lib/payments.ts."
    );
  }

  // Mock: send brugeren til en intern checkout-side der simulerer betaling
  return `/checkout/${bookingId}`;
}

/**
 * Bekræfter betaling og låser bookingen.
 * Kaldes af mock-checkout i udvikling og af Stripe-webhook i produktion.
 */
export async function confirmBookingPayment(bookingId: string, providerRef?: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking findes ikke");
  if (booking.status === "CONFIRMED") return booking; // idempotent

  const fee = platformFee(booking.kind as "COURT" | "COACH", booking.priceKr);

  const [updated] = await db.$transaction([
    db.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED", holdExpiresAt: null },
    }),
    db.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        amountKr: booking.priceKr,
        platformFee: fee,
        provider: process.env.PAYMENT_PROVIDER ?? "mock",
        providerRef: providerRef ?? `mock_${Date.now()}`,
        status: "PAID",
      },
      update: { status: "PAID", providerRef: providerRef ?? undefined },
    }),
  ]);
  return updated;
}

/** Rydder udløbne midlertidige reservationer (kaldes lazily før slot-visning). */
export async function releaseExpiredHolds() {
  await db.booking.updateMany({
    where: { status: "HOLD", holdExpiresAt: { lt: new Date() } },
    data: { status: "CANCELLED" },
  });
}
