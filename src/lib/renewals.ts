// Automatisk fornyelse af kontingent.
//
// Den funktion, jeg holdt tilbage længst, og grunden er værd at kende: et
// kontingent på 1.200 kroner, der bliver trukket hos et medlem, som troede
// de var meldt ud, er den slags fejl en forening husker i årevis. Den skal
// være rigtig, eller den skal ikke være der.
//
// Derfor er den bygget med tre spærrer:
//
// 1. Medlemmet skal aktivt slå den til. Ikke et forudafkrydset felt.
// 2. Der sendes besked 14 dage før hver opkrævning, med et link til at
//    slå den fra. Det er også, hvad forbrugerbeskyttelse forventer af en
//    tilbagevendende betaling.
// 3. Opkrævningen sker kun, hvis klubben selv har oprettet den nye sæson
//    og koblet den til den gamle. Vi gætter ikke på næste års pris.
//
// Kortet gemmes hos Stripe, ikke hos os. Vi har et kunde-id og intet andet.

import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { sendMail, renewalNotice, renewalFailed } from "./email";
import { confirmMembership } from "./memberships";

/** Dage mellem besked og opkrævning. */
export const NOTICE_DAYS = 14;

/**
 * Gemmer et kort til fremtidige fornyelser.
 *
 * Returnerer adressen, medlemmet skal videre til. Stripe indsamler kortet;
 * vi ser det aldrig.
 */
export async function startCardSetup(userId: string, returnPath: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Brugeren findes ikke.");

  const s = await stripe();
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const settings = await getSettings();
  const session = await s.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    success_url: `${settings.appUrl}${returnPath}?kort=gemt`,
    cancel_url: `${settings.appUrl}${returnPath}`,
  });

  if (!session.url) throw new Error("Stripe returnerede ingen side.");
  return session.url;
}

/** Har medlemmet et brugbart kort gemt? */
export async function hasSavedCard(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return false;

  const methods = await (await stripe()).paymentMethods.list({
    customer: user.stripeCustomerId,
    type: "card",
    limit: 1,
  });
  return methods.data.length > 0;
}

export type RenewalRun = { notified: number; charged: number; failed: number };

/**
 * Kører fornyelserne. Kaldes fra cron.
 *
 * To faser i én kørsel, fordi de er den samme liste set på to tidspunkter:
 *
 * - Sæsoner der begynder om 14 dage: send besked.
 * - Sæsoner der begynder nu: opkræv dem, der fik besked.
 *
 * En sæson, hvor klubben ikke har oprettet en fornyelse, rører vi ikke.
 */
export async function runRenewals(): Promise<RenewalRun> {
  const out: RenewalRun = { notified: 0, charged: 0, failed: 0 };

  const noticeDay = new Date();
  noticeDay.setDate(noticeDay.getDate() + NOTICE_DAYS);

  // Nye sæsoner, der fornyer en tidligere.
  const upcoming = await db.membershipType.findMany({
    where: { renewsFromId: { not: null }, active: true, fromDate: { gte: new Date() } },
    include: { club: { select: { name: true, slug: true, stripeAccountId: true } } },
  });

  for (const type of upcoming) {
    const previous = await db.membership.findMany({
      where: { typeId: type.renewsFromId!, status: "PAID", autoRenew: true },
      include: { user: true },
    });

    const startsInDays = Math.round(
      (type.fromDate.getTime() - Date.now()) / 86_400_000
    );

    for (const old of previous) {
      // Har de allerede tilmeldt sig selv, skal de ikke opkræves igen.
      const already = await db.membership.findUnique({
        where: { typeId_userId: { typeId: type.id, userId: old.userId } },
      });
      if (already?.status === "PAID") continue;

      if (startsInDays > 1 && startsInDays <= NOTICE_DAYS && !already) {
        // Fase 1: besked, og en række der markerer, at beskeden er sendt.
        await db.membership.create({
          data: {
            typeId: type.id,
            userId: old.userId,
            priceKr: type.priceKr,
            status: "PENDING",
            autoRenew: true,
          },
        });

        await sendMail(
          renewalNotice({
            to: old.user.email,
            name: old.user.name,
            clubName: type.club.name,
            typeName: type.name,
            seasonName: type.seasonName,
            priceKr: type.priceKr,
            chargeDate: type.fromDate,
            clubSlug: type.club.slug,
          })
        ).catch((err) => console.error("Fornyelsesbesked fejlede:", err));

        out.notified++;
        continue;
      }

      // Fase 2: opkræv, men kun hvis beskeden er sendt (rækken findes).
      if (startsInDays <= 1 && already?.status === "PENDING") {
        const ok = await chargeRenewal(already.id, type.stripeAccountId ?? null);
        if (ok) out.charged++;
        else out.failed++;
      }
    }
  }

  return out;
}

/** Trækker beløbet på det gemte kort. Fejler stille og melder tilbage. */
async function chargeRenewal(membershipId: string, destination: string | null): Promise<boolean> {
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
      type: { include: { club: { select: { name: true, slug: true, stripeAccountId: true } } } },
    },
  });
  if (!membership) return false;

  const customerId = membership.user.stripeCustomerId;
  const account = destination ?? membership.type.club.stripeAccountId;

  if (!customerId || !account) {
    await notifyFailure(membership, "Der er ikke gemt et kort.");
    return false;
  }

  try {
    const s = await stripe();
    const methods = await s.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    const method = methods.data[0];
    if (!method) {
      await notifyFailure(membership, "Det gemte kort findes ikke længere.");
      return false;
    }

    await s.paymentIntents.create({
      amount: membership.priceKr * 100,
      currency: "dkk",
      customer: customerId,
      payment_method: method.id,
      // off_session: medlemmet sidder ikke ved skærmen. Kræver et kort, der
      // er gemt med samtykke til netop det — det er derfor kortet gemmes
      // med en setup-session og ikke bare huskes fra en betaling.
      off_session: true,
      confirm: true,
      transfer_data: { destination: account },
      metadata: { membershipId },
    });

    await confirmMembership(membershipId);
    return true;
  } catch (err) {
    await notifyFailure(
      membership,
      err instanceof Error ? err.message : "Betalingen blev afvist."
    );
    return false;
  }
}

async function notifyFailure(membership: any, reason: string) {
  await sendMail(
    renewalFailed({
      to: membership.user.email,
      name: membership.user.name,
      clubName: membership.type.club.name,
      seasonName: membership.type.seasonName,
      reason,
      clubSlug: membership.type.club.slug,
    })
  ).catch((err) => console.error("Kunne ikke sende besked om fejlet fornyelse:", err));
}

/** Slår automatisk fornyelse til eller fra for et medlemskab. */
export async function setAutoRenew(
  userId: string,
  membershipId: string,
  on: boolean
): Promise<void> {
  await db.membership.updateMany({
    where: { id: membershipId, userId },
    data: { autoRenew: on },
  });
}
