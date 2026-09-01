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
import { commission, COMMISSION_PCT } from "./payments";
import { sendMail } from "./email";

export type Check = {
  name: string;
  status: "ok" | "fejl" | "advarsel";
  detail: string;
};

/** Konfiguration: er de nødvendige nøgler overhovedet sat? */
function configChecks(): Check[] {
  const checks: Check[] = [];

  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  checks.push({
    name: "Betalingsudbyder",
    status: provider === "stripe" ? "ok" : "advarsel",
    detail:
      provider === "stripe"
        ? "Stripe er slået til. Rigtige betalinger."
        : `PAYMENT_PROVIDER er "${provider}" — bookinger bekræftes uden betaling.`,
  });

  checks.push({
    name: "Stripe-nøgle",
    status: stripeEnabled() ? "ok" : "fejl",
    detail: stripeEnabled()
      ? (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")
        ? "Live-nøgle. Rigtige penge."
        : "Testnøgle. Ingen rigtige penge flytter sig."
      : "STRIPE_SECRET_KEY mangler.",
  });

  checks.push({
    name: "Webhook-hemmelighed",
    status: process.env.STRIPE_WEBHOOK_SECRET ? "ok" : "fejl",
    detail: process.env.STRIPE_WEBHOOK_SECRET
      ? "Sat. Betalinger kan bekræftes."
      : "STRIPE_WEBHOOK_SECRET mangler — ingen booking vil nogensinde blive bekræftet.",
  });

  checks.push({
    name: "Adresse til links",
    status: process.env.APP_URL ? "ok" : "advarsel",
    detail: process.env.APP_URL ?? "APP_URL mangler — mails og links bruger en gættet adresse.",
  });

  return checks;
}

/**
 * Sender en rigtig testmail til den adresse, bestillinger går til.
 * Det er den eneste måde at vide, om afsenderdomænet er verificeret —
 * en forkert opsætning giver først en fejl i selve afsendelsen.
 */
async function emailCheck(): Promise<Check> {
  const to = process.env.ORDERS_EMAIL;

  if (!process.env.EMAIL_API_KEY) {
    return {
      name: "E-mail",
      status: "advarsel",
      detail: "EMAIL_API_KEY mangler — kvitteringer logges kun, de sendes ikke.",
    };
  }
  if (!to) {
    return {
      name: "E-mail",
      status: "advarsel",
      detail: "Nøglen er sat, men ORDERS_EMAIL mangler, så testen kan ikke sende nogen steder hen.",
    };
  }

  const sent = await sendMail({
    to,
    subject: "RacketBuddy — selvtest af e-mail",
    body: [
      "Denne mail er sendt af selvtesten på /superadmin/selvtest.",
      "",
      `Afsender: ${process.env.EMAIL_FROM ?? "(standard)"}`,
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
  if (!stripeEnabled()) {
    return {
      name: "Forbindelse til Stripe",
      status: "fejl",
      detail: "Springes over — ingen nøgle sat.",
    };
  }
  try {
    const balance = await stripe().balance.retrieve();
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

/** Regnestykket bag provisionen — ren matematik, ingen sideeffekter. */
function feeChecks(): Check[] {
  const examples = [100, 150, 250];
  const rows = examples.map((price) => {
    const fee = commission(price);
    // Stripes indenlandske kortgebyr: 1,5% + 1,80 kr
    const stripeFee = Math.round((price * 0.015 + 1.8) * 100) / 100;
    const net = Math.round((fee - stripeFee) * 100) / 100;
    return `${price} kr → klub ${price - fee} kr, os ${fee} kr (netto ~${net} kr efter Stripes gebyr)`;
  });

  return [
    {
      name: `Provision (${Math.round(COMMISSION_PCT * 100)}%)`,
      status: "ok",
      detail: rows.join(" · "),
    },
  ];
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
          : `${Math.round(COMMISSION_PCT * 100)}% provision`,
    })),
    ...coaches.map((c: any) => ({
      kind: "Træner" as const,
      name: c.user.name,
      id: c.id,
      hasAccount: Boolean(c.stripeAccountId),
      chargesEnabled: c.stripeChargesEnabled,
      billing: `${Math.round(COMMISSION_PCT * 100)}% provision`,
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
  if (!stripeEnabled()) {
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
  const fee = club.billingModel === "SUBSCRIPTION" ? 0 : commission(priceKr);
  const base = process.env.APP_URL ?? "https://racketbuddy.app";

  try {
    const session = await stripe().checkout.sessions.create({
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
    await stripe().checkout.sessions.expire(session.id).catch(() => null);

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
  const [connectivity, email, checkout, recipients] = await Promise.all([
    connectivityCheck(),
    emailCheck(),
    testCheckoutSession(),
    recipientStatuses(),
  ]);

  return {
    checks: [...configChecks(), connectivity, email, ...feeChecks(), checkout],
    recipients,
  };
}
