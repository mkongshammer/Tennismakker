// Stripes webhook — kilden til sandhed for betalinger.
//
// Kunden kan lukke browseren, miste forbindelsen eller aldrig blive sendt
// tilbage til success_url. Ingen af de ting må forhindre bookingen i at
// blive bekræftet, hvis pengene faktisk er trukket. Derfor sker den
// egentlige bekræftelse her — success_url er kun for brugerens oplevelse.
//
// Sæt denne adresse op i Stripe Dashboard → Developers → Webhooks:
//   https://racketbuddy.app/api/webhooks/stripe
// og lyt på: checkout.session.completed, account.updated,
//   customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted
//
// HÅNDTERER TO FORMATER:
// Stripe har to slags udsendelser. Den klassiske ("snapshot") indeholder
// hele objektet i beskeden. Den nyere ("thin") sender kun et event-id, som
// modtageren selv skal slå op. Vi understøtter begge, fordi en forkert
// indstilling i Stripe-panelet ellers får alle webhooks til at fejle tavst
// — hvilket er præcis, hvad der skete første gang.
import Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { confirmBookingPayment } from "../../../../lib/payments";
import { refreshAccountStatus, findRecipientByAccountId } from "../../../../lib/connect";
import { getSettings } from "../../../../lib/settings";
import { confirmPackagePurchase } from "../../../../lib/packages";
import { syncSubscription } from "../../../../lib/subscription";

export const dynamic = "force-dynamic";

/** Behandler et event, uanset hvordan det kom ind. */
async function handleEvent(type: string, object: any) {
  switch (type) {
    case "checkout.session.completed": {
      const session = object as Stripe.Checkout.Session;

      // Samme event dækker to ting: en gæst der har betalt for en booking,
      // og en klub der lige har lagt kort ind til sit abonnement.
      if (session.mode === "subscription") {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const sub = await (await stripe()).subscriptions.retrieve(subscriptionId);
          await syncSubscription(sub as any);
        }
        return;
      }

      // Et pakkekøb er også en betaling, bare uden en booking bagved.
      const purchaseId = session.metadata?.purchaseId;
      if (purchaseId) {
        await confirmPackagePurchase(purchaseId);
        return;
      }

      const bookingId = session.metadata?.bookingId;
      if (!bookingId) {
        console.error("checkout.session.completed uden bookingId i metadata", session.id);
        return;
      }
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      await confirmBookingPayment(bookingId, paymentIntentId);
      return;
    }

    // Klubben/træneren har ændret noget i deres Stripe-onboarding —
    // opdater om de kan modtage betalinger og udbetalinger endnu.
    case "account.updated": {
      const account = object as Stripe.Account;
      const recipient = await findRecipientByAccountId(account.id);
      if (recipient) {
        await refreshAccountStatus(recipient.kind, recipient.id);
      }
      return;
    }

    // Abonnementet er startet, fornyet, fejlet eller opsagt. Statussen
    // skrives ned, fordi den afgør, om klubben slipper for provision:
    // holder de op med at betale, falder de tilbage på 10%.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(object as any);
      return;
    }

    default:
      // Ukendte events ignoreres bevidst — Stripe sender langt flere
      // event-typer, end vi har brug for at reagere på.
      return;
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = (await getSettings()).stripeWebhookSecret;

  if (!secret) {
    console.error("Webhook-hemmeligheden er ikke sat — webhook afvist.");
    return new Response("Webhook er ikke konfigureret", { status: 500 });
  }
  if (!signature) {
    return new Response("Mangler signatur", { status: 400 });
  }

  // Stripe kræver den RÅ krop for at kunne verificere signaturen — læses
  // derfor som tekst, ikke som JSON, før noget andet rører den.
  const rawBody = await req.text();

  let type: string;
  let object: any;

  try {
    // Klassisk format: hele objektet ligger i beskeden.
    const event = (await stripe()).webhooks.constructEvent(rawBody, signature, secret);
    type = event.type;
    object = (event as any).data?.object;
  } catch (err) {
    // Kunne det være det nye "thin"-format? Der er kun et id i beskeden,
    // og selve objektet skal hentes bagefter.
    const parsed = safeParse(rawBody);
    if (!parsed?.id || !parsed?.type) {
      console.error("Stripe-webhook: ugyldig signatur", err);
      return new Response("Ugyldig signatur", { status: 400 });
    }

    try {
      // Hent hele eventet ud fra id'et. Det er samtidig verifikationen:
      // et opdigtet id findes ikke hos Stripe.
      // Et evt_test_-id på en live-nøgle er en efterladt test-event fra en
      // sandkasse. Den kan ikke hentes, og det er ikke en fejl — så den
      // skal ikke fylde en stak i logfilen.
      if (parsed.id?.startsWith("evt_test_")) {
        console.log("Stripe-webhook: ignorerer test-event i live:", parsed.id);
        return new Response("ok", { status: 200 });
      }

      const full = await (await stripe()).events.retrieve(parsed.id);
      type = full.type;
      object = (full as any).data?.object;
    } catch (retrieveErr) {
      console.error("Stripe-webhook: kunne ikke hente event", parsed.id, retrieveErr);
      return new Response("Kunne ikke hente event", { status: 400 });
    }
  }

  if (!object) {
    console.error("Stripe-webhook: event uden indhold", type);
    return new Response("Event uden indhold", { status: 400 });
  }

  try {
    await handleEvent(type, object);
  } catch (err) {
    // 500 beder Stripe prøve igen senere, i stedet for at give op på et
    // event, der fejlede pga. noget forbigående (fx databasen var langsom).
    console.error(`Stripe-webhook fejlede ved håndtering af ${type}:`, err);
    return new Response("Intern fejl ved behandling", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

function safeParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
