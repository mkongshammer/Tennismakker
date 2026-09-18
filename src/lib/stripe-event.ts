import type Stripe from "stripe";

export class InvalidStripeSignature extends Error {}

/** Signature validation always precedes any API lookup, including thin events. */
export async function verifiedStripeEvent(client: Stripe, raw: string, signature: string, secret: string) {
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(raw, signature, secret);
  } catch {
    let notification;
    try {
      notification = client.parseEventNotification(raw, signature, secret);
    } catch {
      throw new InvalidStripeSignature("Ugyldig Stripe-signatur eller payload.");
    }
    // Genuine v2 thin notifications are also verified by the SDK before fetch.
    const object = "fetchRelatedObject" in notification && typeof notification.fetchRelatedObject === "function"
      ? await notification.fetchRelatedObject() : null;
    return { type: notification.type.replace(/^v1\./, ""), object };
  }
  if (!event?.id || !event.type) throw new InvalidStripeSignature("Ugyldig Stripe-payload.");
  if (event.data?.object) return { type: event.type, object: event.data.object };
  // Some integrations send a compact v1 event. Its signed ID may be resolved,
  // but possession of an unsigned event ID is never authentication.
  if (!event.id.startsWith("evt_")) throw new InvalidStripeSignature("Ugyldigt event-id.");
  const full = await client.events.retrieve(event.id);
  return { type: full.type, object: full.data?.object };
}
