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

/**
 * Hvilket land vores egen Stripe-konto står i.
 *
 * Afgør, om en udbetaling til en klub er indenlandsk eller
 * grænseoverskridende — og det ændrer, hvad Stripe tillader. Slås op én
 * gang pr. proces; en konto skifter ikke land, mens serveren kører.
 */
let platformCountry: string | null = null;

export async function platformAccountCountry(): Promise<string | null> {
  if (platformCountry) return platformCountry;
  try {
    // Et kald uden konto-id henter vores egen konto. Typerne kræver et id,
    // fordi den samme metode også slår forbundne konti op — deraf casten,
    // som er begrænset til denne ene linje.
    const accounts = (await stripe()).accounts as unknown as {
      retrieve(): Promise<{ country?: string | null }>;
    };
    platformCountry = (await accounts.retrieve()).country ?? null;
  } catch {
    platformCountry = null;
  }
  return platformCountry;
}
