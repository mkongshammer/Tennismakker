// Klubbernes abonnement — det, de betaler TIL os.
//
// Vend ikke rundt på de to roller: `stripeAccountId` på klubben er en
// Connect-konto, vi sender penge UD til, når en gæst booker. Her er klubben
// derimod kunde hos os, med en almindelig Stripe-kunde og et abonnement på
// vores egen konto. Samme klub, to id'er, modsat pengestrøm.

import { refreshClubSignup, startOnboardingCheckout } from "./club-onboarding";
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { dataRegionForCountry } from "./region";

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
    metadata: { clubId: club.id, region: dataRegionForCountry(club.country) },
  });

  await db.club.update({
    where: { id: club.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Sender klubadministratoren til Stripe for at lægge et kort ind. */
export async function startSubscriptionCheckout(clubId: string): Promise<string> {
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) throw new Error("Klubben findes ikke.");
  if (club.signupManaged) return startOnboardingCheckout(clubId);
  if (club.billingModel !== "SUBSCRIPTION") {
    throw new Error("Klubben er på provision, ikke abonnement.");
  }

  const settings = await getSettings();
  const customerId = await ensureCustomer(clubId);
  const region = dataRegionForCountry(club.country);

  const taxEnabled=["EUR","USD"].includes(club.billingCurrency);
  const client=await stripe();
  if(taxEnabled&&(await client.tax.settings.retrieve()).status!=="active")throw Error("Tax setup is not ready. Please contact RacketBuddy.");
  const session = await client.checkout.sessions.create({adaptive_pricing:{enabled:false},
    automatic_tax:{enabled:taxEnabled},billing_address_collection:"required",tax_id_collection:{enabled:true},customer_update:{name:"auto",address:"auto"},
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          tax_behavior:taxEnabled?"exclusive":undefined,
          currency: club.billingCurrency.toLowerCase(),
          unit_amount: club.subscriptionKr * 100,
          recurring: { interval: club.subscriptionInterval === "YEAR" ? "year" : "month" },
          product_data: { name: `RacketBuddy Standard — ${club.name}` },
        },
        quantity: 1,
      },
    ],
    subscription_data: { metadata: { clubId: club.id, region } },
    metadata: { clubId: club.id, region },
    success_url: `${settings.appUrl}/admin?abonnement=ok`,
    cancel_url: `${settings.appUrl}/admin?abonnement=afbrudt`,
  });

  if (!session.url) throw new Error("Stripe returnerede ingen betalingsside.");
  return session.url;
}

/** Stripes kundeportal: skift kort, se fakturaer, opsig. */
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
  metadata?: { clubId?: string; region?: string } | null;
  customer?: string | { id: string };
  current_period_end?: number;
}): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const club =
    (subscription.metadata?.clubId
      ? await db.club.findUnique({ where: { id: subscription.metadata.clubId } })
      : null) ??
    (customerId ? await db.club.findFirst({ where: { stripeCustomerId: customerId } }) : null);

  if (!club) {
    console.error("Abonnement uden klub:", subscription.id);
    return;
  }

  if (club.signupManaged) { await refreshClubSignup(club.id); return; }

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


/**
 * Monthly → annual (or back) on a running subscription. Stripe swaps the
 * price on the existing item, bills the prorated difference now and starts
 * a new cycle today. The club's own record follows so the sign-up check
 * (price, interval) still matches.
 */
export async function switchBillingInterval(clubId: string, interval: "MONTH" | "YEAR"): Promise<void> {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  if (!club.subscriptionId || !["active", "trialing", "past_due"].includes(club.subscriptionStatus ?? "")) throw Error("Der er intet aktivt abonnement at ændre.");
  if (club.subscriptionInterval === interval) return;
  const { clubSignupPrices, isFoundingClub } = await import("./club-onboarding");
  const { FOUNDING_MONTHLY_USD, FOUNDING_ANNUAL_USD } = await import("./platform-pricing");
  const prices = await clubSignupPrices(club.country);
  if (prices.currency !== club.billingCurrency) throw Error("Prisbogen matcher ikke klubbens valuta. Kontakt RacketBuddy.");
  // Founding clubs keep $50/$500 for life; everyone else switches at today's regular price.
  const founding = isFoundingClub(club);
  const amount = founding ? (interval === "YEAR" ? FOUNDING_ANNUAL_USD : FOUNDING_MONTHLY_USD) : interval === "YEAR" ? prices.annual : prices.standard;
  const client = await stripe();
  const sub = await client.subscriptions.retrieve(club.subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw Error("Abonnementet har ingen pris.");
  const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  const taxEnabled = ["EUR", "USD"].includes(club.billingCurrency);
  await client.subscriptions.update(club.subscriptionId, {
    items: [{ id: item.id, price_data: { currency: club.billingCurrency.toLowerCase(), product, unit_amount: amount * 100, recurring: { interval: interval === "YEAR" ? "year" : "month" }, tax_behavior: taxEnabled ? "exclusive" : undefined } }],
    proration_behavior: "always_invoice",
    billing_cycle_anchor: "now",
    metadata: { clubId: club.id, region: dataRegionForCountry(club.country) },
  }, { idempotencyKey: `switch-interval:${club.subscriptionId}:${interval}:${new Date().toISOString().slice(0, 10)}` });
  await db.club.update({ where: { id: clubId }, data: { subscriptionKr: amount, subscriptionInterval: interval } });
  if (club.signupManaged) await refreshClubSignup(clubId).catch((err) => console.error("Refresh after interval switch failed:", err));
}
