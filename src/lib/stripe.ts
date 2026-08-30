// Stripe-klienten, ét sted.
//
// Initialiseres kun hvis STRIPE_SECRET_KEY er sat. Uden nøglen kører
// platformen videre med mock-betalinger — en manglende nøgle skal aldrig
// vælte serveren, kun forhindre rigtige betalinger.

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY er ikke sat. Sæt PAYMENT_PROVIDER=mock i .env, eller tilføj nøglen."
      );
    }
    client = new Stripe(key, {
      typescript: true,
    });
  }
  return client;
}
