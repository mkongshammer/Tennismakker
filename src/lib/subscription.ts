// Klubbernes abonnement — det, de betaler TIL os.
//
// Vend ikke rundt på de to roller: `stripeAccountId` på klubben er en
// Connect-konto, vi sender penge UD til, når en gæst booker. Her er klubben
// derimod kunde hos os, med en almindelig Stripe-kunde og et abonnement på
// vores egen konto. Samme klub, to id'er, modsat pengestrøm.
//
// Prisen laves som `price_data` direkte i checkout frem for et Produkt i
// Stripe-panelet. Hver klub har sin egen aftalte pris, og et katalog af
// produkter, der skal holdes i sync med `subscriptionKr`, ville være to
// steder at rette det samme.

import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";

export { subscriptionIsActive, describeSubscription } from "./billing";
export type { ClubBilling } from "./billing";

/** Klubben som kunde hos os. Oprettes første gang, den skal betale noget. */
async function ensureCustomer(clubId: string): Promise<string> {
  const club = await db.club.findUnique({
    where: { id: clubId },
    include: { members: { where: { role: "CLUB_ADMIN" }, take: 1 } },
  });
  if (!club) throw new Error("Klubben findes ikke.");
  if (club.stripeCustomerId) return club.stripeCustomerId;

  const customer = await (await stripe()).customers.create({
    name: club.name,
    email: club.members[0]?.email ?? club.contactEmail ?? undefined,
    metadata: { clubId: club.id },
  });

  await db.club.update({
    where: { id: club.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/**
 * Sender klubadministratoren til Stripe for at lægge et kort ind.
 * Returnerer adressen, de skal videre til.
 */
export async function startSubscriptionCheckout(clubId: string): Promise<string> {
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) throw new Error("Klubben findes ikke.");
  if (club.billingModel !== "SUBSCRIPTION") {
    throw new Error("Klubben er på provision, ikke abonnement.");
  }

  const settings = await getSettings();
  const customerId = await ensureCustomer(clubId);

  const session = await (await stripe()).checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "dkk",
          unit_amount: club.subscriptionKr * 100,
          recurring: { interval: "month" },
          product_data: { name: `RacketBuddy — abonnement for ${club.name}` },
        },
        quantity: 1,
      },
    ],
    subscription_data: { metadata: { clubId: club.id } },
    metadata: { clubId: club.id },
    success_url: `${settings.appUrl}/admin?abonnement=ok`,
    cancel_url: `${settings.appUrl}/admin?abonnement=afbrudt`,
  });

  if (!session.url) throw new Error("Stripe returnerede ingen betalingsside.");
  return session.url;
}

/**
 * Stripes eget selvbetjeningspanel: skift kort, se fakturaer, opsig.
 *
 * Panelet skal slås til én gang i Stripe under Settings → Billing → Customer
 * portal. Er det ikke gjort, fejler kaldet — og det er bedre at sige det
 * højt end at sende klubben videre til en tom side.
 */
export async function billingPortalUrl(clubId: string): Promise<string> {
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club?.stripeCustomerId) {
    throw new Error("Klubben har ikke noget abonnement at administrere endnu.");
  }

  const settings = await getSettings();
  try {
    const portal = await (await stripe()).billingPortal.sessions.create({
      customer: club.stripeCustomerId,
      return_url: `${settings.appUrl}/admin`,
    });
    return portal.url;
  } catch (err) {
    console.error("Stripes kundeportal kunne ikke åbnes:", err);
    throw new Error(
      "Kundeportalen er ikke slået til i Stripe endnu (Settings → Billing → Customer portal)."
    );
  }
}

/** Skriver Stripes status ned på klubben. Kaldes fra webhooken. */
export async function syncSubscription(subscription: {
  id: string;
  status: string;
  metadata?: { clubId?: string } | null;
  customer?: string | { id: string };
  current_period_end?: number;
}): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  // Metadata er den sikre vej; kunde-id'et er reserven, hvis abonnementet
  // er oprettet i Stripe-panelet i hånden og altså ikke har vores metadata.
  const club =
    (subscription.metadata?.clubId
      ? await db.club.findUnique({ where: { id: subscription.metadata.clubId } })
      : null) ??
    (customerId ? await db.club.findFirst({ where: { stripeCustomerId: customerId } }) : null);

  if (!club) {
    console.error("Abonnement uden klub:", subscription.id);
    return;
  }

  await db.club.update({
    where: { id: club.id },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionRenewsAt: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    },
  });
}
