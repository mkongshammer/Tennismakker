// Webhooken hos Stripe — set fra appens side.
//
// Hele klassen af fejl her stammer fra, at endpointet oprettes ét sted i
// hånden, mens nøglen kommer et andet sted fra: en sandkasse, den gamle
// testtilstand, live. Sandkasse og live er adskilte verdener, og et
// endpoint i den ene findes ikke i den anden. Fejlen er tavs — betalingen
// går igennem, bookingen bliver bare aldrig bekræftet.
//
// Derfor gør appen det selv. Den opretter endpointet med præcis den nøgle,
// den også bruger til alt andet, så de to per definition er i samme verden.
// Og fordi Stripe kun udleverer signeringsnøglen i selve oprettelsen,
// gemmes den med det samme frem for at skulle kopieres over af et menneske.

import { stripe, stripeEnabled } from "./stripe";
import { getSettings, saveSettings } from "./settings";

/** De events, appen skal have for at fungere. Se src/app/api/webhooks/stripe. */
export const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "account.updated",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

export const WEBHOOK_PATH = "/api/webhooks/stripe";

const sameUrl = (a: string, b: string) =>
  a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

export type WebhookState = {
  status: "ok" | "advarsel" | "fejl";
  detail: string;
  /** Kan appen selv rette op på det med ét klik? */
  fixable: boolean;
};

/** Hvilken verden nøglen hører til, sagt så et menneske kan se det. */
function keyMode(secretKey: string): string {
  return secretKey.startsWith("sk_live_") ? "live" : "sandkasse/test";
}

/**
 * Findes der et endpoint til os, i samme verden som nøglen, og lytter det
 * på det rigtige?
 *
 * Tjekket kan ikke bevise, at den gemte signeringsnøgle hører til netop
 * dette endpoint — Stripe udleverer den kun ved oprettelsen. Men det kan
 * svare på de to spørgsmål, der faktisk går galt.
 */
export async function inspectWebhook(): Promise<WebhookState> {
  if (!(await stripeEnabled())) {
    return { status: "fejl", detail: "Springes over — ingen Stripe-nøgle.", fixable: false };
  }

  const settings = await getSettings();
  const mode = keyMode(settings.stripeSecretKey);
  const wanted = `${settings.appUrl}${WEBHOOK_PATH}`;

  let endpoints;
  try {
    endpoints = (await (await stripe()).webhookEndpoints.list({ limit: 100 })).data;
  } catch (err) {
    return {
      status: "advarsel",
      detail: `Kunne ikke slå webhooks op: ${err instanceof Error ? err.message : "ukendt fejl"}.`,
      fixable: false,
    };
  }

  const ours = endpoints.find((e) => sameUrl(e.url, wanted));

  if (!ours) {
    return {
      status: "fejl",
      fixable: true,
      detail:
        endpoints.length === 0
          ? `Der findes ingen webhooks i ${mode} overhovedet. Nøglen og endpointet er altså ikke i samme verden.`
          : `Ingen af de ${endpoints.length} webhooks i ${mode} peger på ${wanted}. Bookinger bliver ikke bekræftet af webhooken.`,
    };
  }

  if (ours.status !== "enabled") {
    return {
      status: "fejl",
      fixable: false,
      detail: `Endpointet findes i ${mode}, men er slået fra hos Stripe. Slå det til der.`,
    };
  }

  const missing = ours.enabled_events.includes("*")
    ? []
    : REQUIRED_EVENTS.filter((e) => !ours.enabled_events.includes(e));

  if (missing.length > 0) {
    return {
      status: "advarsel",
      fixable: true,
      detail: `Endpointet findes i ${mode}, men lytter ikke på ${missing.join(", ")}.`,
    };
  }

  return {
    status: "ok",
    fixable: false,
    detail: `Registreret i ${mode} og lytter på alt, appen har brug for. Om signeringsnøglen passer, viser sig først ved en rigtig betaling.`,
  };
}

/**
 * Opretter endpointet — eller retter et, der mangler events.
 *
 * Ved oprettelse gemmes signeringsnøglen samme sted, i samme kald. Det er
 * hele pointen: nøglen kan ikke ende med at høre til et andet endpoint end
 * det, der findes, for de bliver til samtidig.
 */
export async function ensureWebhookEndpoint(): Promise<string> {
  if (!(await stripeEnabled())) {
    throw new Error("Der er ingen Stripe-nøgle at oprette webhooken med.");
  }

  const settings = await getSettings();
  const mode = keyMode(settings.stripeSecretKey);
  const url = `${settings.appUrl}${WEBHOOK_PATH}`;
  const client = await stripe();

  const existing = (await client.webhookEndpoints.list({ limit: 100 })).data.find((e) =>
    sameUrl(e.url, url)
  );

  if (existing) {
    await client.webhookEndpoints.update(existing.id, { enabled_events: REQUIRED_EVENTS as any });
    return `Endpointet fandtes allerede i ${mode} og lytter nu på alle fem events. Signeringsnøglen er urørt — Stripe udleverer den kun ved oprettelsen, så passer den ikke, skal endpointet slettes hos Stripe og oprettes her igen.`;
  }

  const created = await client.webhookEndpoints.create({
    url,
    enabled_events: REQUIRED_EVENTS as any,
    description: "RacketBuddy",
  });

  if (!created.secret) {
    throw new Error(
      "Stripe oprettede endpointet, men returnerede ingen signeringsnøgle. Hent den i Stripe-panelet, og indsæt den herunder."
    );
  }

  await saveSettings({ stripeWebhookSecret: created.secret });

  return `Endpointet er oprettet i ${mode} på ${url}, og signeringsnøglen er gemt. Kør selvtesten for at se det grønt.`;
}
