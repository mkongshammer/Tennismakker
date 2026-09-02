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
import { stripe } from "./stripe";
import { ensureSettings, getSettings } from "./settings";
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
// Satsen kan ændres under Opsætning; dette er den, en tom opsætning bruger.
export const DEFAULT_COMMISSION_PCT = 0.10;

/** Provisionen af et beløb med en given sats, afrundet til hele kroner. */
export function commissionAt(amountKr: number, pct: number): number {
  return Math.round(amountKr * pct);
}

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
  if (booking.kind === "COACH") return commission(booking.priceKr);

  if (!booking.courtId) return commission(booking.priceKr);

  const court = await db.court.findUnique({
    where: { id: booking.courtId },
    include: { club: { select: { billingModel: true } } },
  });
  if (court?.club.billingModel === "SUBSCRIPTION") return 0;

  return commission(booking.priceKr);
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
  const isSubscriptionClub = fee === 0 && kind === "CLUB";

  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    // MobilePay slås til i Stripe Dashboard under Payment methods — når
    // det er gjort, dukker det automatisk op her uden kodeændringer.
    payment_method_types: ["card"],
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

/** Sender kvittering til spilleren og besked til klub eller træner. */
async function notifyBookingConfirmed(booking: any) {
  const what =
    booking.kind === "COURT"
      ? `${booking.court?.club.name} — ${booking.court?.name}`
      : `Trænertime hos ${booking.coachProfile?.user.name}`;

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

  const what =
    booking.kind === "COURT"
      ? `${booking.court?.club.name} — ${booking.court?.name}`
      : `Trænertime hos ${booking.coachProfile?.user.name}`;

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
