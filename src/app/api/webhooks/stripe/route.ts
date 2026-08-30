// Stripes webhook — kilden til sandhed for betalinger.
//
// Kunden kan lukke browseren, miste forbindelsen eller aldrig blive sendt
// tilbage til success_url. Ingen af de ting må forhindre bookingen i at
// blive bekræftet, hvis pengene faktisk er trukket. Derfor sker den
// egentlige bekræftelse her — success_url er kun for brugerens oplevelse.
//
// Sæt denne adresse op i Stripe Dashboard → Developers → Webhooks:
//   https://<dit-domæne>/api/webhooks/stripe
// og lyt på: checkout.session.completed, account.updated
import Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { confirmBookingPayment } from "../../../../lib/payments";
import { refreshAccountStatus, findRecipientByAccountId } from "../../../../lib/connect";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET er ikke sat — webhook afvist.");
    return new Response("Webhook er ikke konfigureret", { status: 500 });
  }
  if (!signature) {
    return new Response("Mangler signatur", { status: 400 });
  }

  // Stripe kræver den RÅ krop for at kunne verificere signaturen — læses
  // derfor som tekst, ikke som JSON, før noget andet rører den.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("Stripe-webhook: ugyldig signatur", err);
    return new Response("Ugyldig signatur", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (!bookingId) {
          console.error("checkout.session.completed uden bookingId i metadata", session.id);
          break;
        }
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        await confirmBookingPayment(bookingId, paymentIntentId);
        break;
      }

      // Klubben/træneren har ændret noget i deres Stripe-onboarding —
      // opdater om de kan modtage betalinger og udbetalinger endnu.
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const recipient = await findRecipientByAccountId(account.id);
        if (recipient) {
          await refreshAccountStatus(recipient.kind, recipient.id);
        }
        break;
      }

      default:
        // Ukendte events ignoreres bevidst — Stripe sender langt flere
        // event-typer, end vi har brug for at reagere på.
        break;
    }
  } catch (err) {
    // 500 beder Stripe prøve igen senere, i stedet for at give op på et
    // event, der fejlede pga. noget forbigående (fx databasen var langsom).
    console.error(`Stripe-webhook fejlede ved håndtering af ${event.type}:`, err);
    return new Response("Intern fejl ved behandling", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
