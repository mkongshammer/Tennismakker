// Stripe Connect: de konti, penge sendes videre til.
//
// Klubben og træneren skal hver have en "Express"-konto hos Stripe, før de
// kan modtage penge. Express er den lette model — Stripe står for hele
// registreringsflowet (identitet, bankkonto), vi skal bare sende dem derhen
// og tage imod dem bagefter.
//
// Et enkelt navn går igen i det følgende: "recipient". En bane-booking
// betaler til klubben, en trænertime betaler til træneren — men mekanikken
// (opret konto, send til onboarding, læs status tilbage) er identisk.

import { stripe } from "./stripe";
import { db } from "./db";
import { getSettings } from "./settings";

export type RecipientKind = "CLUB" | "COACH";

type Recipient = {
  kind: RecipientKind;
  id: string; // Club.id eller CoachProfile.id
  email: string;
  name: string;
  country: string; // ISO-landekode, fx "DK"
  stripeAccountId: string | null;
};

async function loadRecipient(kind: RecipientKind, id: string): Promise<Recipient | null> {
  if (kind === "CLUB") {
    const club = await db.club.findUnique({
      where: { id },
      include: { members: { where: { role: "CLUB_ADMIN" }, take: 1 } },
    });
    if (!club) return null;
    const admin = club.members[0];
    return {
      kind,
      id: club.id,
      email: admin?.email ?? club.contactEmail ?? "",
      name: club.name,
      country: club.country,
      stripeAccountId: club.stripeAccountId,
    };
  }

  const coach = await db.coachProfile.findUnique({ where: { id }, include: { user: true } });
  if (!coach) return null;
  return {
    kind,
    id: coach.id,
    email: coach.user.email,
    name: coach.user.name,
    country: coach.user.country,
    stripeAccountId: coach.stripeAccountId,
  };
}

async function saveAccountId(kind: RecipientKind, id: string, accountId: string) {
  if (kind === "CLUB") {
    await db.club.update({ where: { id }, data: { stripeAccountId: accountId } });
  } else {
    await db.coachProfile.update({ where: { id }, data: { stripeAccountId: accountId } });
  }
}

/** Opretter en Express-konto, hvis der ikke allerede findes én. */
export async function ensureConnectAccount(
  kind: RecipientKind,
  id: string
): Promise<string> {
  const recipient = await loadRecipient(kind, id);
  if (!recipient) throw new Error("Modtageren findes ikke.");
  if (recipient.stripeAccountId) return recipient.stripeAccountId;

  const account = await (await stripe()).accounts.create({
    type: "express",
    country: recipient.country,
    email: recipient.email || undefined,
    business_type: kind === "CLUB" ? "non_profit" : "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { kind, recipientId: id },
  });

  await saveAccountId(kind, id, account.id);
  return account.id;
}

/**
 * Genererer et link, modtageren skal igennem for at fuldføre opsætningen
 * (identitet, bankkonto). Linket udløber efter et par minutter — det skal
 * altid genereres friskt, aldrig gemmes og genbruges.
 */
export async function createOnboardingLink(
  accountId: string,
  returnPath: string,
  refreshPath: string
): Promise<string> {
  const base = (await getSettings()).appUrl;
  const link = await (await stripe()).accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${base}${returnPath}`,
    refresh_url: `${base}${refreshPath}`,
  });
  return link.url;
}

/** Slår op hos Stripe, om kontoen kan modtage og udbetale penge endnu. */
export async function refreshAccountStatus(
  kind: RecipientKind,
  id: string
): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean } | null> {
  const recipient = await loadRecipient(kind, id);
  if (!recipient?.stripeAccountId) return null;

  // Kan kontoen ikke slås op, tæller den som ude af stand til at modtage
  // penge — ikke som "uændret".
  //
  // Det afgørende tilfælde er skiftet fra sandkasse til live: Connect-konti
  // findes kun i den verden, de blev oprettet i, så et acct_-id fra test
  // eksisterer ikke, når nøglen er live. Uden dette ville databasen blive
  // ved med at påstå, at klubben var klar, mens enhver booking blev afvist.
  const account = await (await stripe()).accounts
    .retrieve(recipient.stripeAccountId)
    .catch(() => null);

  const chargesEnabled = Boolean(account?.charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled);

  if (kind === "CLUB") {
    await db.club.update({
      where: { id },
      data: { stripeChargesEnabled: chargesEnabled, stripePayoutsEnabled: payoutsEnabled },
    });
  } else {
    await db.coachProfile.update({
      where: { id },
      data: { stripeChargesEnabled: chargesEnabled, stripePayoutsEnabled: payoutsEnabled },
    });
  }

  return { chargesEnabled, payoutsEnabled };
}

/** Bruges af webhooken: find hvilken klub/træner en Stripe-konto tilhører. */
export async function findRecipientByAccountId(
  accountId: string
): Promise<{ kind: RecipientKind; id: string } | null> {
  const club = await db.club.findFirst({
    where: { stripeAccountId: accountId },
    select: { id: true },
  });
  if (club) return { kind: "CLUB", id: club.id };

  const coach = await db.coachProfile.findFirst({
    where: { stripeAccountId: accountId },
    select: { id: true },
  });
  if (coach) return { kind: "COACH", id: coach.id };

  return null;
}
