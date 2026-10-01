// Pure payment checks shared by checkout returns and webhook processing.
// A checkout URL, a successful redirect or a session ID is not proof of payment.
import { toMinor } from "./international";
export type CheckoutEvidence = {
  id: string;
  mode: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string } | null;
};

export type BookingPaymentProof =
  | { provider: "stripe"; session: CheckoutEvidence }
  | { provider: "mock"; userId: string };

export function checkoutIsSettled(session: Pick<CheckoutEvidence, "payment_status">) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export function validateCheckoutPayment(
  booking: { id: string; priceKr: number; currency?: string },
  session: CheckoutEvidence,
): string {
  if (session.mode !== "payment" || session.metadata?.bookingId !== booking.id) {
    throw new Error("Betalingen tilhører ikke denne booking.");
  }
  if (!Number.isSafeInteger(booking.priceKr) || booking.priceKr < 0 ||
      session.amount_total !== toMinor(booking.priceKr, booking.currency ?? "DKK") || session.currency?.toUpperCase() !== (booking.currency ?? "DKK")) {
    throw new Error("Betalingens beløb eller valuta stemmer ikke med bookingen.");
  }
  if (!checkoutIsSettled(session) || (session.payment_status === "no_payment_required" && booking.priceKr !== 0)) {
    throw new Error("Betalingen er ikke gennemført endnu.");
  }
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent : session.payment_intent?.id;
  if (booking.priceKr > 0 && !paymentIntent?.startsWith("pi_")) {
    throw new Error("Betalingen mangler en gyldig betalingsreference.");
  }
  return paymentIntent || session.id;
}

export function bookingCanBePaid(
  booking: { status: string; holdExpiresAt: Date | null }, now = new Date(),
) {
  return booking.status === "HOLD" && (!booking.holdExpiresAt || booking.holdExpiresAt > now);
}

export function validateOrderCheckout(order: { id: string; priceKr: number; currency?: string }, session: CheckoutEvidence, metadataKey: string) {
  if (session.mode !== "payment" || session.metadata?.[metadataKey] !== order.id ||
      session.currency?.toUpperCase() !== (order.currency ?? "DKK") ||
      session.amount_total !== toMinor(order.priceKr,order.currency ?? "DKK") ||
      !checkoutIsSettled(session) || (order.priceKr > 0 && session.payment_status !== "paid")) {
    throw Error("Betalingens beløb, valuta eller ordre stemmer ikke.");
  }
}
