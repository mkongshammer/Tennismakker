// Stripe-klienten, ét sted.
//
// Nøglen kommer fra opsætningen (databasen, ellers miljøet), og derfor er
// funktionen asynkron. Til gengæld kan nøglen skiftes fra
// /superadmin/opsaetning uden en genstart: klienten bygges om, så snart den
// opdager en anden nøgle end den, den sidst blev bygget med.
//
// Uden nøgle kaster stripe(). Det er med vilje — platformen kører videre med
// mock-betalinger, og en manglende nøgle skal aldrig vælte serveren, kun
// forhindre rigtige betalinger.

import Stripe from "stripe";
import { getSettings } from "./settings";

let client: { key: string; stripe: Stripe } | null = null;

export async function stripeEnabled(): Promise<boolean> {
  return Boolean((await getSettings()).stripeSecretKey);
}

export async function stripe(): Promise<Stripe> {
  const key = (await getSettings()).stripeSecretKey;
  if (!key) {
    throw new Error(
      "Der er ingen Stripe-nøgle. Sæt den under Opsætning, eller vælg mock-betaling."
    );
  }
  if (!client || client.key !== key) {
    client = { key, stripe: new Stripe(key, { typescript: true }) };
  }
  return client.stripe;
}
