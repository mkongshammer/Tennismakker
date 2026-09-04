// Sæsonhold.
//
// Træningshold over en sæson: "Voksne begyndere, tirsdag 18-19, forår
// 2026". Halbookings "Book sæsonhold".
//
// Holdet reserverer ikke banen. Det er et bevidst valg: klubben lægger
// holdene i deres skema og spærrer tiden med en fast bane, hvis de vil
// have den låst. Ville vi selv oprette 22 bookinger pr. hold, ville et
// hold med aflyst træning i efterårsferien kræve, at nogen huskede at
// slette syv bookinger — én pr. deltager.

import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";

export type TeamView = {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  dayOfWeek: number;
  hour: number;
  minutes: number;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  capacity: number;
  taken: number;
  full: boolean;
  levelFrom: number;
  levelTo: number;
  coachName: string | null;
};

/** De hold, klubben har åbnet for tilmelding, og som ikke er slut. */
export async function openTeams(clubId: string): Promise<TeamView[]> {
  const teams = await db.seasonTeam.findMany({
    where: { clubId, active: true, toDate: { gte: new Date() } },
    orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }],
    include: {
      coachProfile: { include: { user: { select: { name: true } } } },
      _count: { select: { signups: { where: { status: "PAID" } } } },
    },
  });

  return teams.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    sport: t.sport,
    dayOfWeek: t.dayOfWeek,
    hour: t.hour,
    minutes: t.minutes,
    fromDate: t.fromDate,
    toDate: t.toDate,
    priceKr: t.priceKr,
    capacity: t.capacity,
    taken: t._count.signups,
    full: t.capacity > 0 && t._count.signups >= t.capacity,
    levelFrom: t.levelFrom,
    levelTo: t.levelTo,
    coachName: t.coachProfile?.user.name ?? null,
  }));
}

export type SignupResult =
  | { ok: true; checkoutUrl: string | null }
  | { ok: false; error: string };

/**
 * Tilmelder til et hold og sender til betaling.
 *
 * Pladsen er først reserveret, når der er betalt. Alternativet — at holde
 * pladsen mens man betaler — ville betyde, at et hold på otte kunne stå
 * fuldtegnet med otte halvfærdige tilmeldinger, og klubben ville tro, de
 * var solgt.
 */
export async function signUpForTeam(userId: string, teamId: string): Promise<SignupResult> {
  const team = await db.seasonTeam.findUnique({
    where: { id: teamId },
    include: {
      club: {
        select: {
          name: true,
          slug: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
        },
      },
    },
  });
  if (!team || !team.active) return { ok: false, error: "Holdet er ikke åbent." };
  if (team.toDate < new Date()) return { ok: false, error: "Sæsonen er slut." };

  const existing = await db.teamSignup.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing?.status === "PAID") return { ok: false, error: "Du er allerede tilmeldt." };

  if (team.capacity > 0) {
    const taken = await db.teamSignup.count({ where: { teamId, status: "PAID" } });
    if (taken >= team.capacity) return { ok: false, error: "Holdet er fuldtegnet." };
  }

  const signup = existing
    ? await db.teamSignup.update({
        where: { id: existing.id },
        data: { priceKr: team.priceKr, status: "PENDING" },
      })
    : await db.teamSignup.create({
        data: { teamId, userId, priceKr: team.priceKr },
      });

  const settings = await getSettings();

  if (team.priceKr <= 0 || settings.paymentProvider !== "stripe") {
    await confirmTeamSignup(signup.id);
    return { ok: true, checkoutUrl: null };
  }

  // Holdpengene er klubbens. Samme regel som kontingentet: uden
  // transfer_data ville de lande på vores konto.
  if (!team.club.stripeAccountId || !team.club.stripeChargesEnabled) {
    await db.teamSignup.update({ where: { id: signup.id }, data: { status: "CANCELLED" } });
    return {
      ok: false,
      error: "Klubben kan ikke tage imod betaling endnu. Skriv til klubben.",
    };
  }

  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    payment_intent_data: {
      transfer_data: { destination: team.club.stripeAccountId },
      metadata: { teamSignupId: signup.id },
    },
    line_items: [
      {
        price_data: {
          currency: "dkk",
          product_data: {
            name: team.name,
            description: `Sæsonhold i ${team.club.name}`,
          },
          unit_amount: team.priceKr * 100,
        },
        quantity: 1,
      },
    ],
    metadata: { teamSignupId: signup.id },
    success_url: `${settings.appUrl}/klub/${team.club.slug}?hold=ok`,
    cancel_url: `${settings.appUrl}/klub/${team.club.slug}?hold=afbrudt`,
  });

  await db.teamSignup.update({
    where: { id: signup.id },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) return { ok: false, error: "Stripe returnerede ingen betalingsside." };
  return { ok: true, checkoutUrl: session.url };
}

/** Markerer tilmeldingen som betalt. Kan kaldes flere gange uden skade. */
export async function confirmTeamSignup(signupId: string): Promise<void> {
  await db.teamSignup.updateMany({
    where: { id: signupId, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date() },
  });
}
