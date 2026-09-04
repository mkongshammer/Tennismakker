// Betalingslag for RacketBuddy.
//
// Arkitektur-princip (vigtigt, jf. forretningsplanen):
// Penge skal kunne splittes mellem klub/træner og platformen (kommission).
// Derfor er laget bygget som en "marketplace"-abstraktion fra dag ét, så
// Stripe Connect (eller en dansk PSP med split payment) kan sættes ind
// uden at røre resten af koden.
//
// I udvikling bruges MockProvider: betalinger markeres som betalt med det
// samme, men hele flowet (hold -> checkout -> bekræftelse -> udbetalingssplit)
// er identisk med produktion.
//
// Produktion med Stripe (skitse):
// 1. Opret Stripe-konto + aktiver Stripe Connect (Express-konti til klubber/trænere).
// 2. Ved checkout: opret PaymentIntent med `application_fee_amount` = platformFee
//    og `transfer_data.destination` = klubbens/trænerens Connect-konto.
//    MobilePay slås til som payment method i Stripe Dashboard.
// 3. Webhook (payment_intent.succeeded) kalder confirmBookingPayment() nedenfor.

import { db } from "./db";
import { platformAccountCountry, stripe } from "./stripe";
import { ensureSettings, getSettings } from "./settings";
import { describeLength } from "./slots";
import { subscriptionIsActive } from "./billing";
import { refundCredit } from "./packages";
import type { RecipientKind } from "./connect";
import {
  bookingReceipt,
  cancellationNotice,
  clubBookingNotice,
  coachBookingNotice,
  sendMail,
} from "./email";

// Platformens andel af hver transaktion.
//
// 10% på både baner og trænertimer. Én sats er lettere at forklare i et
// klubmøde end to, og den holder over Stripes gebyr: en indenlandsk
// betaling koster 1,5% + 1,80 kr, så en banetime til 100 kr giver
// 10,00 − 3,30 = 6,70 kr tilbage. Ved en lavere sats ville små bookinger
// koste os penge frem for at tjene dem.
export { DEFAULT_COMMISSION_PCT, commissionAt } from "./billing";
import { commissionAt } from "./billing";

/** Provisionen af et beløb med den sats, der gælder lige nu. */
export async function commission(amountKr: number): Promise<number> {
  return commissionAt(amountKr, (await getSettings()).commissionPct);
}

/**
 * Hvad platformen tjener på en konkret booking.
 *
 * Klubber på abonnement betaler et fast beløb om måneden i stedet for
 * provision, så deres banebookinger giver 0 her — hele beløbet går til
 * klubben. Trænertimer er altid på provision: træneren er selvstændig og
 * har ikke et abonnement.
 */
export async function platformFeeForBooking(booking: {
  kind: string;
  priceKr: number;
  courtId?: string | null;
}): Promise<number> {
  // Trænertimer er på provision. En træner er selvstændig og har ikke et
  // abonnement — 199 kr om måneden for en person, der giver to timer om
  // ugen, ville lukke ned for trænerne, før de kom i gang.
  if (booking.kind === "COACH") return commission(booking.priceKr);

  // Banebookinger: intet fradrag. Hele beløbet går til klubben, og vi lever
  // af abonnementet.
  //
  // Før faldt en klub uden aktivt abonnement tilbage på 10% provision. Den
  // model findes ikke længere: der er én pris, og konsekvensen af manglende
  // betaling er, at klubben ikke kan frigive nye tider — se
  // requireActiveSubscription() i actions.ts. Vi tager ikke penge fra en
  // booking, klubben har fået ind.
  return 0;
}

/**
 * Starter en betaling for en booking der er i HOLD-status.
 * Returnerer en checkout-URL som brugeren sendes til.
 *
 * Med Stripe er dette en "destination charge": kunden betaler det fulde
 * beløb, Stripe sender automatisk (priceKr − platformFee) videre til
 * klubbens eller trænerens egen konto, og vores andel (platformFee) bliver
 * stående hos os. Stripes eget transaktionsgebyr trækkes fra VORES andel,
 * ikke oveni klubbens — det er derfor provisionen er sat til 10% og ikke
 * lavere, se COMMISSION_PCT ovenfor.
 */
export async function startCheckout(bookingId: string): Promise<string> {
  const settings = await getSettings();
  if (settings.paymentProvider !== "stripe") return `/checkout/${bookingId}`;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      court: { include: { club: true } },
      coachProfile: { include: { user: true } },
    },
  });
  if (!booking) throw new Error("Booking findes ikke");

  const kind: RecipientKind = booking.kind === "COACH" ? "COACH" : "CLUB";
  const recipientId =
    kind === "COACH" ? booking.coachProfileId! : booking.court!.clubId;

  const account = await (await stripe()).accounts.retrieve(
    (kind === "COACH" ? booking.coachProfile?.stripeAccountId : booking.court?.club.stripeAccountId) ?? ""
  ).catch(() => null);

  if (!account?.charges_enabled) {
    const who = kind === "COACH" ? "Træneren" : "Klubben";
    throw new Error(
      `${who} har ikke fuldført opsætningen af udbetalinger endnu. Prøv igen senere, eller vælg en anden tid.`
    );
  }

  const fee = await platformFeeForBooking(booking);
  const what =
    kind === "COACH"
      ? `Trænertime hos ${booking.coachProfile?.user.name}`
      : `${booking.court?.club.name} — ${booking.court?.name}`;

  const base = settings.appUrl;

  // Hvem betaler Stripes eget gebyr, afhænger af klubbens model.
  //
  // Ved provision (fee > 0) er vi som standard ansvarlige for Stripes
  // gebyr i en destination charge — det er fint, for gebyret trækkes fra
  // vores egen andel, og det er netop derfor provisionen er 10% og ikke
  // lavere (se COMMISSION_PCT).
  //
  // Ved abonnement er vores andel 0 kr. Uden videre ville VI stadig
  // hæfte for Stripes gebyr på hver eneste booking, uden noget at dække
  // det med — platformen ville tabe penge på hver transaktion. Derfor
  // sættes `on_behalf_of` her, som flytter ansvaret for Stripes gebyr
  // over på klubbens egen konto. Klubben betaler et fast beløb om
  // måneden i stedet for provision, og betaler så Stripes gebyr som en
  // hvilken som helst anden erhvervsdrivende, der tager kortbetaling.
  // fee er kun 0 for en klub, hvis abonnementet betales — se
  // platformFeeForBooking. Derfor er dette samtidig tjekket på, om klubben
  // skal bære Stripes gebyr selv.
  //
  // MEN: står platformen og klubben i hvert sit land, er udbetalingen
  // grænseoverskridende, og dér tillader Stripe ikke `on_behalf_of` på en
  // destination charge. Kaldet ville blive afvist, og bookingen fejle for
  // enhver abonnementsklub. Så bærer vi gebyret i stedet — det er, hvad
  // abonnementet skal dække.
  const platformCountry = await platformAccountCountry();
  const sameCountry = Boolean(
    platformCountry && account.country && platformCountry === account.country
  );
  const isSubscriptionClub = fee === 0 && kind === "CLUB" && sameCountry;

  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    // Ingen payment_method_types: så bruger Stripe de metoder, der er slået
    // til i panelet. Var den låst til ["card"], ville MobilePay aldrig dukke
    // op, uanset hvad man slog til — og det er præcis den slags, man leder
    // efter i den forkerte ende i en time.
    line_items: [
      {
        price_data: {
          currency: "dkk",
          product_data: { name: what },
          unit_amount: booking.priceKr * 100, // Stripe regner i øre
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: fee * 100,
      transfer_data: { destination: account.id },
      ...(isSubscriptionClub ? { on_behalf_of: account.id } : {}),
      metadata: { bookingId },
    },
    metadata: { bookingId },
    // Send brugeren via vores egen bekræftelsesrute i stedet for direkte
    // til profilen. Den spørger Stripe, om betalingen faktisk gik igennem,
    // og bekræfter bookingen med det samme — så oplevelsen ikke afhænger
    // af, at webhooken når frem først.
    success_url: `${base}/checkout/${bookingId}/faerdig?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/profil`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // matcher HOLD-vinduet med god margen
  });

  if (!session.url) throw new Error("Stripe returnerede ingen betalingsside.");
  return session.url;
}

/**
 * Bekræfter betaling og låser bookingen.
 * Kaldes af mock-checkout i udvikling og af Stripe-webhook i produktion.
 */
export async function confirmBookingPayment(bookingId: string, providerRef?: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      court: { include: { club: { include: { members: true } } } },
      coachProfile: { include: { user: true } },
    },
  });
  if (!booking) throw new Error("Booking findes ikke");
  if (booking.status === "CONFIRMED") return booking; // idempotent
  // Sidste bælte: en anmodning uden trænerens ja må ikke kunne bekræftes,
  // heller ikke af en webhook der kommer fra en anden vej.
  if (booking.status === "REQUESTED") {
    throw new Error("Timen er ikke godkendt af træneren endnu.");
  }

  // Varm opsætningen inden kvitteringerne bygges — skabelonerne læser
  // adressen synkront, mens de sammensættes.
  await ensureSettings();
  const settings = await getSettings();
  const fee = await platformFeeForBooking(booking);

  const [updated] = await db.$transaction([
    db.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED", holdExpiresAt: null },
    }),
    db.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        amountKr: booking.priceKr,
        platformFee: fee,
        provider: settings.paymentProvider,
        providerRef: providerRef ?? `mock_${Date.now()}`,
        status: "PAID",
      },
      update: { status: "PAID", providerRef: providerRef ?? undefined },
    }),
  ]);

  await notifyBookingConfirmed(booking);
  return updated;
}

/**
 * Hvad bookingen hedder i en mail.
 *
 * Trænertimer er ikke nødvendigvis en time, så længden står med — ellers
 * ville en kvittering på en 45-minutters lektion se ud præcis som en på en
 * hel, og eleven ville ikke kunne se forskel.
 */
function bookingLabel(booking: any): string {
  if (booking.kind === "COURT") {
    return `${booking.court?.club.name} — ${booking.court?.name}`;
  }
  return `Trænertime hos ${booking.coachProfile?.user.name} (${describeLength(
    lessonMinutesOf(booking)
  )})`;
}

function lessonMinutesOf(booking: any): number {
  return Math.round(
    (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60000
  );
}

/** Sender kvittering til spilleren og besked til klub eller træner. */
/**
 * Kvittering til gæsten og besked til klubben.
 *
 * Eksporteret, fordi en gratis medlemsbooking bekræftes uden at gå gennem
 * betalingen — og kvitteringen med dørkoden skal sendes uanset, om der blev
 * trukket penge.
 */
export async function notifyBookingConfirmed(booking: any) {
  const what = bookingLabel(booking);

  await sendMail(
    bookingReceipt({
      to: booking.user.email,
      name: booking.user.name,
      what,
      startsAt: booking.startsAt,
      priceKr: booking.priceKr,
      bookingId: booking.id,
      access:
        booking.kind === "COURT" && booking.court
          ? {
              hasLock: booking.court.club.hasLock,
              code: booking.court.club.accessCode,
              instructions: booking.court.club.accessInstructions,
            }
          : undefined,
    })
  );

  if (booking.kind === "COURT" && booking.court) {
    // Besked til klubbens administratorer
    const admins = booking.court.club.members.filter(
      (m: any) => m.role === "CLUB_ADMIN"
    );
    for (const admin of admins) {
      await sendMail(
        clubBookingNotice({
          to: admin.email,
          clubName: booking.court.club.name,
          courtName: booking.court.name,
          playerName: booking.user.name,
          playerEmail: booking.user.email,
          startsAt: booking.startsAt,
          priceKr: booking.priceKr,
          needsClubEntry: booking.needsClubEntry,
          externalSystem: booking.court.club.externalSystem,
        })
      );
    }
  }

  if (booking.kind === "COACH" && booking.coachProfile) {
    await sendMail(
      coachBookingNotice({
        to: booking.coachProfile.user.email,
        coachName: booking.coachProfile.user.name,
        length: describeLength(lessonMinutesOf(booking)),
        playerName: booking.user.name,
        playerEmail: booking.user.email,
        startsAt: booking.startsAt,
        priceKr: booking.priceKr,
      })
    );
  }
}

/** Timer før spilletidspunktet hvor aflysning stadig giver pengene retur. */
export const REFUND_WINDOW_HOURS = 24;

/**
 * Aflyser en booking og refunderer, hvis den ligger mere end 24 timer ude
 * i fremtiden. Returnerer det refunderede beløb, eller null hvis fristen
 * var overskredet.
 */
export async function cancelAndRefund(bookingId: string): Promise<number | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      payment: true,
      court: { include: { club: true } },
      coachProfile: { include: { user: true } },
    },
  });
  if (!booking) throw new Error("Booking findes ikke");

  await ensureSettings();

  const hoursUntil =
    (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
  const eligible = hoursUntil >= REFUND_WINDOW_HOURS;
  const paid = booking.payment?.status === "PAID";

  await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });

  // Blev timen betalt med et klip fra et pakkeforløb, skal klippet tilbage.
  // Der er ingen betaling at refundere — eleven har betalt for pakken, og
  // et klip, der forsvinder ved en aflysning, er penge, de har mistet.
  //
  // Klippet gives tilbage uanset frist. En for sen aflysning koster
  // klippet i praksis alligevel, hvis træneren ikke kan sælge tiden — men
  // det er en samtale mellem elev og træner, ikke noget systemet skal
  // afgøre på deres vegne.
  if (booking.packagePurchaseId) {
    await refundCredit(booking.packagePurchaseId);
  }

  let refunded: number | null = null;
  if (paid && eligible) {
    if (booking.payment?.provider === "stripe" && booking.payment.providerRef) {
      // reverse_transfer trækker pengene tilbage fra klubbens/trænerens
      // konto (destination charge sender dem derud automatisk ved betaling).
      // refund_application_fee giver også vores egen andel tilbage — vi har
      // jo ikke leveret noget, når bookingen aflyses.
      await (await stripe()).refunds.create({
        payment_intent: booking.payment.providerRef,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }
    await db.payment.update({
      where: { bookingId },
      data: { status: "REFUNDED" },
    });
    refunded = booking.payment!.amountKr;
  }

  const what = bookingLabel(booking);

  await sendMail(
    cancellationNotice({
      to: booking.user.email,
      name: booking.user.name,
      what,
      startsAt: booking.startsAt,
      refundKr: paid ? refunded : 0,
    })
  );

  return refunded;
}

/** Rydder udløbne midlertidige reservationer (kaldes lazily før slot-visning). */
export async function releaseExpiredHolds() {
  await db.booking.updateMany({
    where: { status: "HOLD", holdExpiresAt: { lt: new Date() } },
    data: { status: "CANCELLED" },
  });
}
