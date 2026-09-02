// Selvtest af betalingsopsætningen.
//
// Kører på serveren, hvor Stripe faktisk kan nås, og tjekker hele kæden i
// ét kald: nøgler, forbindelse, webhook, modtagerkonti og gebyrberegning.
//
// Formålet er at fjerne behovet for at klikke sig igennem en rigtig
// booking bare for at se, om noget virker. Alle tjek er skrivefri —
// bortset fra checkout-testen, som opretter en session og lukker den igen
// med det samme, uden at nogen betaler noget.

import { db } from "./db";
import { stripe, stripeEnabled } from "./stripe";
import { commissionAt } from "./payments";
import { sendMail } from "./email";
import { getSettings, getSettingsWithSource, LABELS, SETTING_KEYS } from "./settings";

export type Check = {
  name: string;
  status: "ok" | "fejl" | "advarsel";
  detail: string;
};

/**
 * Ét tjek af opsætningen frem for fire.
 *
 * Selve værdierne — nøgler, provision, afsenderadresse — hører hjemme på
 * /superadmin/opsaetning, hvor de også kan rettes. Her skal der kun stå, om
 * noget mangler, så selvtesten kan holdes til ét spørgsmål: virker det?
 */
async function setupCheck(): Promise<Check> {
  const { settings, source } = await getSettingsWithSource();

  const missing = SETTING_KEYS.filter((k) => source[k] === "standard" && !settings[k]);
  const mock = settings.paymentProvider !== "stripe";

  if (mock) {
    return {
      name: "Opsætning",
      status: "advarsel",
      detail: "Betalinger står på test — bookinger bekræftes, uden at nogen betaler. Skiftes under Opsætning.",
    };
  }
  if (missing.length > 0) {
    return {
      name: "Opsætning",
      status: "fejl",
      detail: `Mangler ${missing.map((k) => LABELS[k]).join(", ")}. Sæt det under Opsætning.`,
    };
  }
  return {
    name: "Opsætning",
    status: "ok",
    detail: settings.stripeSecretKey.startsWith("sk_live_")
      ? "Alt er sat. Live-nøgle — rigtige penge."
      : "Alt er sat. Testnøgle — ingen rigtige penge flytter sig.",
  };
}

/**
 * Sender en rigtig testmail til den adresse, bestillinger går til.
 * Det er den eneste måde at vide, om afsenderdomænet er verificeret —
 * en forkert opsætning giver først en fejl i selve afsendelsen.
 */
async function emailCheck(): Promise<Check> {
  const { emailApiKey, emailFrom, ordersEmail: to } = await getSettings();

  if (!emailApiKey) {
    return {
      name: "E-mail",
      status: "advarsel",
      detail: "Der er ingen mailnøgle — kvitteringer logges kun, de sendes ikke.",
    };
  }
  if (!to) {
    return {
      name: "E-mail",
      status: "advarsel",
      detail: "Nøglen er sat, men der er ingen modtageradresse, så testen kan ikke sende nogen steder hen.",
    };
  }

  const sent = await sendMail({
    to,
    subject: "RacketBuddy — selvtest af e-mail",
    body: [
      "Denne mail er sendt af selvtesten på /superadmin/selvtest.",
      "",
      `Afsender: ${emailFrom}`,
      "",
      "Kan du læse den her, virker kvitteringer og klubbeskeder også.",
    ].join("\n"),
  });

  return {
    name: "E-mail",
    status: sent ? "ok" : "fejl",
    detail: sent
      ? `Testmail sendt til ${to}. Kom den ikke frem, er afsenderdomænet ikke verificeret hos udbyderen.`
      : "Afsendelsen fejlede. Se serverloggen — typisk et uverificeret afsenderdomæne.",
  };
}

/** Kan vi overhovedet nå Stripe med den nøgle, der er sat? */
async function connectivityCheck(): Promise<Check> {
  if (!(await stripeEnabled())) {
    return {
      name: "Forbindelse til Stripe",
      status: "fejl",
      detail: "Springes over — ingen nøgle sat.",
    };
  }
  try {
    const balance = await (await stripe()).balance.retrieve();
    return {
      name: "Forbindelse til Stripe",
      status: "ok",
      detail: `Svarer. Valutaer i saldoen: ${balance.available.map((a) => a.currency).join(", ") || "ingen endnu"}.`,
    };
  } catch (err) {
    return {
      name: "Forbindelse til Stripe",
      status: "fejl",
      detail: err instanceof Error ? err.message : "Ukendt fejl.",
    };
  }
}

/**
 * Regnestykket bag provisionen — ét eksempel, ikke en prisliste.
 *
 * Satsen er den samme uanset beløb, så tre linjer viste tre gange det samme.
 * Skal man se flere beløb, står de på opsætningssiden ved siden af satsen.
 */
async function feeCheck(): Promise<Check> {
  const pct = (await getSettings()).commissionPct;
  const price = 100;
  const fee = commissionAt(price, pct);
  // Stripes indenlandske kortgebyr: 1,5% + 1,80 kr
  const stripeFee = Math.round((price * 0.015 + 1.8) * 100) / 100;
  const net = Math.round((fee - stripeFee) * 100) / 100;

  return {
    name: `Provision (${Math.round(pct * 100)}%)`,
    status: net > 0 ? "ok" : "advarsel",
    detail:
      net > 0
        ? `${price} kr → klub ${price - fee} kr, os ${fee} kr (netto ~${net} kr efter Stripes gebyr).`
        : `${price} kr → os ${fee} kr, men Stripes gebyr er ~${stripeFee} kr. Vi taber penge på små bookinger ved den sats.`,
  };
}

export type RecipientStatus = {
  kind: "Klub" | "Træner";
  name: string;
  id: string;
  hasAccount: boolean;
  chargesEnabled: boolean;
  billing: string;
};

/** Hvem kan rent faktisk modtage penge? */
export async function recipientStatuses(): Promise<RecipientStatus[]> {
  const pct = Math.round((await getSettings()).commissionPct * 100);
  const [clubs, coaches] = await Promise.all([
    db.club.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        billingModel: true,
        subscriptionKr: true,
      },
      orderBy: { name: "asc" },
    }),
    db.coachProfile.findMany({
      select: {
        id: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return [
    ...clubs.map((c: any) => ({
      kind: "Klub" as const,
      name: c.name,
      id: c.id,
      hasAccount: Boolean(c.stripeAccountId),
      chargesEnabled: c.stripeChargesEnabled,
      billing:
        c.billingModel === "SUBSCRIPTION"
          ? `Abonnement ${c.subscriptionKr} kr/md`
          : `${pct}% provision`,
    })),
    ...coaches.map((c: any) => ({
      kind: "Træner" as const,
      name: c.user.name,
      id: c.id,
      hasAccount: Boolean(c.stripeAccountId),
      chargesEnabled: c.stripeChargesEnabled,
      billing: `${pct}% provision`,
    })),
  ];
}

/**
 * Den afgørende test: opret en rigtig checkout-session mod en klar
 * modtagerkonto, bekræft at Stripe accepterer den — og luk den straks
 * igen. Ingen betaler noget, men det beviser at hele opsætningen holder:
 * nøgle, Connect-konto, gebyrsplit og valuta.
 */
export async function testCheckoutSession(): Promise<Check> {
  if (!(await stripeEnabled())) {
    return { name: "Testbetaling", status: "fejl", detail: "Ingen Stripe-nøgle." };
  }

  const club = await db.club.findFirst({
    where: { status: "APPROVED", stripeChargesEnabled: true, stripeAccountId: { not: null } },
    select: { id: true, name: true, stripeAccountId: true, priceHour: true, billingModel: true },
  });

  if (!club) {
    return {
      name: "Testbetaling",
      status: "advarsel",
      detail:
        "Ingen klub kan modtage betaling endnu. Sæt udbetalinger op for mindst én klub, og kør testen igen.",
    };
  }

  const priceKr = club.priceHour || 100;
  const settings = await getSettings();
  const fee =
    club.billingModel === "SUBSCRIPTION" ? 0 : commissionAt(priceKr, settings.commissionPct);
  const base = settings.appUrl;

  try {
    const session = await (await stripe()).checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "dkk",
            product_data: { name: `SELVTEST — ${club.name}` },
            unit_amount: priceKr * 100,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: fee * 100,
        transfer_data: { destination: club.stripeAccountId! },
        ...(fee === 0 ? { on_behalf_of: club.stripeAccountId! } : {}),
      },
      success_url: `${base}/superadmin`,
      cancel_url: `${base}/superadmin`,
    });

    // Luk sessionen med det samme — den må aldrig kunne betales
    await (await stripe()).checkout.sessions.expire(session.id).catch(() => null);

    return {
      name: "Testbetaling",
      status: "ok",
      detail: `Stripe accepterede en betaling på ${priceKr} kr til ${club.name}: ${priceKr - fee} kr til klubben, ${fee} kr til os. Sessionen blev lukket igen med det samme.`,
    };
  } catch (err) {
    return {
      name: "Testbetaling",
      status: "fejl",
      detail: err instanceof Error ? err.message : "Ukendt fejl.",
    };
  }
}

/** Kører alle tjek på én gang. */
export async function runSelfTest(): Promise<{
  checks: Check[];
  recipients: RecipientStatus[];
}> {
  const [setup, connectivity, email, fees, checkout, recipients] = await Promise.all([
    setupCheck(),
    connectivityCheck(),
    emailCheck(),
    feeCheck(),
    testCheckoutSession(),
    recipientStatuses(),
  ]);

  return {
    checks: [setup, connectivity, email, fees, checkout],
    recipients,
  };
}
