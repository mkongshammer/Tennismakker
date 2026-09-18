// Pure payment checks shared by checkout returns and webhook processing.
// A checkout URL, a successful redirect or a session ID is not proof of payment.
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
  booking: { id: string; priceKr: number },
  session: CheckoutEvidence,
): string {
  if (session.mode !== "payment" || session.metadata?.bookingId !== booking.id) {
    throw new Error("Betalingen tilhører ikke denne booking.");
  }
  if (!Number.isSafeInteger(booking.priceKr) || booking.priceKr < 0 ||
      session.amount_total !== booking.priceKr * 100 || session.currency?.toLowerCase() !== "dkk") {
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
