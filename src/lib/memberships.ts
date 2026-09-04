// Kontingent.
//
// Klubbens indtægt, og den funktion der afgør, om en klub kan forlade
// Halbooking. Booking kan man leve uden i en måned; kontingentet er hele
// foreningens økonomi.
//
// To valg er værd at kende:
//
// Sæsoner frem for løbende måneder, fordi det er sådan danske klubber gør
// det: "Sommer 01.05 – 30.09" til en fast pris. En månedlig model ville
// tvinge klubberne til at lave deres vedtægter om for at bruge os.
//
// Betaling én gang pr. sæson frem for automatisk fornyelse. Fornyelse med
// gemt kort kan bygges, men den skal være rigtig: et kontingent, der bliver
// trukket automatisk hos et medlem, der troede de var meldt ud, er den
// slags fejl en forening husker. Indtil da minder vi klubben om at åbne den
// nye sæson, og medlemmet tilmelder sig selv igen.

import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { membershipReceipt, sendMail } from "./email";

/**
 * Er personen medlem af klubben lige nu?
 *
 * Et betalt kontingent, hvis sæson dækker i dag. Det er svaret på "må
 * denne person booke til medlemspris", og det skal være det samme svar
 * hele vejen igennem — derfor ét sted.
 */
export async function isPayingMember(userId: string, clubId: string): Promise<boolean> {
  const now = new Date();
  const found = await db.membership.findFirst({
    where: {
      userId,
      status: "PAID",
      type: { clubId, fromDate: { lte: now }, toDate: { gte: now } },
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Tæller personen som medlem, når prisen skal sættes?
 *
 * To modeller lever side om side, og det er med vilje:
 *
 * - Klubber uden kontingent hos os bruger tilmeldingskoden. Der er
 *   `User.clubId` hele sandheden.
 * - Klubber, der opkræver kontingent hos os, skal have betalingen til at
 *   gælde. Ellers ville et medlem, hvis sæson sluttede i september, booke
 *   til medlemspris resten af året.
 *
 * Derfor: man skal være koblet til klubben, OG hvis klubben har
 * kontingenter, skal et af dem være betalt og løbende. Uden det sidste
 * ville de klubber, der ikke bruger vores kontingent, miste deres
 * medlemspriser den dag, funktionen blev udrullet.
 */
export async function countsAsMember(
  userClubId: string | null,
  clubId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId || userClubId !== clubId) return false;

  const hasTypes = await db.membershipType.count({ where: { clubId } });
  if (hasTypes === 0) return true;

  return isPayingMember(userId, clubId);
}

/** De sæsoner, klubben har åbnet for tilmelding. */
export async function openTypes(clubId: string) {
  const types = await db.membershipType.findMany({
    where: { clubId, active: true, toDate: { gte: new Date() } },
    orderBy: [{ sortOrder: "asc" }, { priceKr: "asc" }],
    include: { _count: { select: { memberships: { where: { status: "PAID" } } } } },
  });

  return types.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    seasonName: t.seasonName,
    fromDate: t.fromDate,
    toDate: t.toDate,
    priceKr: t.priceKr,
    capacity: t.capacity,
    taken: t._count.memberships,
    full: t.capacity > 0 && t._count.memberships >= t.capacity,
  }));
}

export type JoinResult =
  | { ok: true; checkoutUrl: string }
  | { ok: true; checkoutUrl: null }
  | { ok: false; error: string };

/**
 * Tilmelder et medlem en sæson og sender til betaling.
 *
 * Er kontingentet gratis — nogle klubber har æresmedlemmer eller
 * ungdomsafdelinger uden betaling — bliver det aktivt med det samme.
 * Stripe afviser i øvrigt et beløb på nul.
 */
export async function joinMembership(userId: string, typeId: string): Promise<JoinResult> {
  const type = await db.membershipType.findUnique({
    where: { id: typeId },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          slug: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
        },
      },
    },
  });
  if (!type || !type.active) return { ok: false, error: "Kontingentet er ikke åbent." };
  if (type.toDate < new Date()) return { ok: false, error: "Sæsonen er slut." };

  const existing = await db.membership.findUnique({
    where: { typeId_userId: { typeId, userId } },
  });
  if (existing?.status === "PAID") {
    return { ok: false, error: "Du er allerede tilmeldt den sæson." };
  }

  if (type.capacity > 0) {
    const taken = await db.membership.count({ where: { typeId, status: "PAID" } });
    if (taken >= type.capacity) return { ok: false, error: "Sæsonen er fuldtegnet." };
  }

  const membership = existing
    ? await db.membership.update({
        where: { id: existing.id },
        data: { priceKr: type.priceKr, status: "PENDING" },
      })
    : await db.membership.create({
        data: { typeId, userId, priceKr: type.priceKr, status: "PENDING" },
      });

  if (type.priceKr <= 0) {
    await confirmMembership(membership.id);
    return { ok: true, checkoutUrl: null };
  }

  const settings = await getSettings();
  if (settings.paymentProvider !== "stripe") {
    await confirmMembership(membership.id);
    return { ok: true, checkoutUrl: null };
  }

  // Kontingentet er klubbens penge, ikke vores. Uden transfer_data ville
  // det lande på VORES Stripe-konto — vi ville sidde på en forenings
  // medlemsindtægt, mens skærmen lovede, at den gik direkte til klubben.
  //
  // Kan klubben ikke tage imod betaling endnu, siger vi det, frem for at
  // lade Stripe fejle med en besked, ingen kan bruge.
  if (!type.club.stripeAccountId || !type.club.stripeChargesEnabled) {
    await db.membership.update({
      where: { id: membership.id },
      data: { status: "CANCELLED" },
    });
    return {
      ok: false,
      error:
        "Klubben kan ikke tage imod betaling endnu. Skriv til klubben — de mangler at fuldføre deres udbetalingsopsætning.",
    };
  }

  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    payment_intent_data: {
      // Ingen provision. Kontingentet går ubeskåret til klubben; vi lever
      // af abonnementet.
      transfer_data: { destination: type.club.stripeAccountId },
      metadata: { membershipId: membership.id },
    },
    line_items: [
      {
        price_data: {
          currency: "dkk",
          product_data: {
            name: `${type.name} — ${type.seasonName}`,
            description: `Kontingent i ${type.club.name}`,
          },
          unit_amount: type.priceKr * 100,
        },
        quantity: 1,
      },
    ],
    metadata: { membershipId: membership.id },
    success_url: `${settings.appUrl}/klub/${type.club.slug}?kontingent=ok`,
    cancel_url: `${settings.appUrl}/klub/${type.club.slug}?kontingent=afbrudt`,
  });

  await db.membership.update({
    where: { id: membership.id },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) return { ok: false, error: "Stripe returnerede ingen betalingsside." };
  return { ok: true, checkoutUrl: session.url };
}

/**
 * Markerer kontingentet som betalt og gør personen til medlem.
 *
 * Kan kaldes flere gange uden skade — webhooks kommer nogle gange to
 * gange, og et medlemskab må ikke blive til to.
 */
export async function confirmMembership(membershipId: string): Promise<void> {
  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { type: { select: { clubId: true } } },
  });
  if (!membership || membership.status === "PAID") return;

  await db.membership.update({
    where: { id: membershipId },
    data: { status: "PAID", paidAt: new Date() },
  });

  // Medlemskabet er det, der kobler personen til klubben. Uden dette er de
  // stadig gæst og betaler gæstepris for hver bane.
  //
  // En klubadministrator får IKKE sin clubId overskrevet. Melder formanden
  // i én klub sig ind i nabolklubben, ville han ellers miste adgangen til
  // sin egen klubs administration — og det opdager man som en meget
  // ubehagelig telefonsamtale.
  const person = await db.user.findUnique({
    where: { id: membership.userId },
    select: { role: true, clubId: true },
  });

  if (person && person.role !== "CLUB_ADMIN") {
    await db.user.update({
      where: { id: membership.userId },
      data: { clubId: membership.type.clubId },
    });
  }

  // Kvittering. Et kontingent er ofte over tusind kroner, og et medlem skal
  // have noget på skrift — både for sin egen skyld og til klubbens
  // bogføring.
  const full = await db.membership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
      type: { include: { club: { select: { name: true } } } },
    },
  });

  if (full) {
    await sendMail(
      membershipReceipt({
        to: full.user.email,
        name: full.user.name,
        clubName: full.type.club.name,
        typeName: full.type.name,
        seasonName: full.type.seasonName,
        fromDate: full.type.fromDate,
        toDate: full.type.toDate,
        priceKr: full.priceKr,
      })
    ).catch((err) => console.error("Kunne ikke sende kontingentkvittering:", err));
  }
}
