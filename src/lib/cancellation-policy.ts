// Who cancelled a booking decides what the customer gets back.
//
// The rule is deliberately simple and written down once, here, so the
// player's profile, the club's schedule, the e-mail and the Stripe call
// all agree:
//
//   PLAYER  cancels  → full refund when the start is ≥ 24 h away, otherwise
//                      nothing. The player made a choice; the court was held
//                      for them and may not be resold.
//   CLUB    cancels  → full refund, always. The customer did nothing; the
//                      club could not deliver the court. Their payout for
//                      this booking is reversed, as is our fee.
//   COACH   cancels  → full refund, always, for the same reason.
//   SYSTEM  cancels  → full refund, always (expired holds, payment
//                      reconciliation, operator intervention).
//
// Package credits and punch-card credits are always returned regardless of
// who cancelled; see cancelAndRefund().

export const REFUND_WINDOW_HOURS = 24;

export type CancellationActor = "PLAYER" | "CLUB" | "COACH" | "SYSTEM";

export const CANCELLATION_ACTORS: readonly CancellationActor[] = ["PLAYER", "CLUB", "COACH", "SYSTEM"];

export interface CancellationContext {
  /** Who is cancelling. */
  by: CancellationActor;
  /** The signed-in user performing the cancellation, for the audit trail. */
  actorUserId?: string | null;
  /** Free-text reason shown to the customer when a club or coach cancels. */
  reason?: string | null;
}

export type RefundDecision =
  | { refund: true; because: "initiated-by-counterparty" | "within-window" }
  | { refund: false; because: "late-cancellation" };

/** Pure decision: does the paying customer get their money back? */
export function refundDecision(input: { by: CancellationActor; startsAt: Date; now?: Date }): RefundDecision {
  if (input.by !== "PLAYER") return { refund: true, because: "initiated-by-counterparty" };
  const now = input.now ?? new Date();
  const hoursUntil = (input.startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil >= REFUND_WINDOW_HOURS) return { refund: true, because: "within-window" };
  return { refund: false, because: "late-cancellation" };
}

/** Normalises an optional free-text reason from a form: trimmed, bounded, or null. */
export function cancellationReason(raw: unknown): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 280);
}

export function isCancellationActor(value: unknown): value is CancellationActor {
  return typeof value === "string" && (CANCELLATION_ACTORS as readonly string[]).includes(value);
}
