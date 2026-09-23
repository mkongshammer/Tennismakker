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
// 3. Betalte checkout-events kalder confirmBookingPayment() nedenfor.

import { useWalletIfCovered, cancelWalletBooking } from "./wallet";
import { db } from "./db";
import { platformAccountCountry, stripe } from "./stripe";
import { ensureSettings, getSettings } from "./settings";
import { describeLength } from "./slots";
import { subscriptionIsActive } from "./billing";
import { refundCredit } from "./packages";
import { refundPunch } from "./punch-cards";
import { bookingCanBePaid, validateCheckoutPayment, type BookingPaymentProof } from "./payment-validation";
import type { RecipientKind } from "./connect";
import { prepareBookingCheckout, resumeBookingCheckout, closeBookingCheckout } from "./booking-checkout";
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

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      court: { include: { club: true } },
      coachProfile: { include: { user: true } },
    },
  });
  if (!booking) throw new Error("Booking findes ikke");
  if (!bookingCanBePaid(booking)) throw new Error("Reservationen er udløbet eller kan ikke betales.");
  if (booking.checkoutParams) return resumeBookingCheckout(booking);
  if (await useWalletIfCovered(booking.userId,booking.id)) return "/profil?wallet=1";
  if (settings.paymentProvider !== "stripe") return `/checkout/${bookingId}`;

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

  // Preserve the existing settlement-merchant configuration. on_behalf_of
  // is not evidence that Stripe's processing fees are charged to the club.
  // Platform commission is calculated separately and frozen with the attempt.
  const platformCountry = await platformAccountCountry();
  const sameCountry = Boolean(
    platformCountry && account.country && platformCountry === account.country
  );
  const isSubscriptionClub = fee === 0 && kind === "CLUB" && sameCountry;

  return prepareBookingCheckout(bookingId, {
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
    metadata: { bookingId, checkoutRevision: "v1" },
    // Send brugeren via vores egen bekræftelsesrute i stedet for direkte
    // til profilen. Den spørger Stripe, om betalingen faktisk gik igennem,
    // og bekræfter bookingen med det samme — så oplevelsen ikke afhænger
    // af, at webhooken når frem først.
    success_url: `${base}/checkout/${bookingId}/faerdig?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/profil`,
    // Stripe requires at least 30 minutes. Five extra minutes allow creation
    // retries; this exact timestamp is also persisted as the local deadline.
    expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
  });
}

/**
 * Bekræfter betaling og låser bookingen.
 * Kaldes af mock-checkout i udvikling og af Stripe-webhook i produktion.
 */
export async function confirmBookingPayment(bookingId: string, proof: BookingPaymentProof) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      court: { include: { club: { include: { members: true } } } },
      coachProfile: { include: { user: true } },
      payment: true,
    },
  });
  if (!booking) throw new Error("Booking findes ikke");
  await ensureSettings();
  const settings = await getSettings();
  let providerRef: string;
  if (proof.provider === "stripe") {
    providerRef = validateCheckoutPayment(booking, proof.session);
  } else {
    if (settings.paymentProvider !== "mock" || proof.userId !== booking.userId) {
      throw new Error("Demo-betaling er ikke tilladt.");
    }
    providerRef = `mock_${booking.id}`;
  }
  const samePayment = (current: typeof booking) => current?.status === "CONFIRMED" &&
    current.payment?.status === "PAID" && current.payment.provider === proof.provider &&
    current.payment.providerRef === providerRef;
  if (samePayment(booking)) return booking;
  // Managed checkouts keep the slot held until Stripe proves expiry. A signed
  // paid event may arrive after the deadline without reviving a cancelled slot.
  const managedProof = proof.provider === "stripe" && Boolean(booking.checkoutParams) &&
    (booking.checkoutSessionId === proof.session.id ||
      (!booking.checkoutSessionId && proof.session.metadata?.checkoutRevision === "v1"));
  if (booking.checkoutParams && !managedProof) {
    throw new Error("Betalingsbeviset matcher ikke bookingens gemte Stripe-session.");
  }
  if (!bookingCanBePaid(booking) && !(managedProof && booking.status === "HOLD")) {
    throw new Error("Reservationen er ikke længere aktiv. En eventuel betaling skal afstemmes, før tiden kan bekræftes.");
  }
  const fee = managedProof
    ? Number(JSON.parse(booking.checkoutParams!).payment_intent_data.application_fee_amount) / 100
    : await platformFeeForBooking(booking);
  if (!Number.isFinite(fee) || fee < 0) throw new Error("Betalingens platformgebyr er ugyldigt.");
  const result = await db.$transaction(async (tx) => {
    // Compare-and-set in the same transaction as Payment: only one simultaneous
    // webhook/return request can win and send the booking notification.
    const changed = await tx.booking.updateMany({
      where: { id: bookingId, status: "HOLD", ...(managedProof ? { checkoutParams: booking.checkoutParams } : { OR: [
        { holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } },
      ] }) },
      data: { status: "CONFIRMED", holdExpiresAt: null,
        ...(managedProof && proof.provider === "stripe" ? { checkoutSessionId: proof.session.id } : {}) },
    });
    if (changed.count === 0) {
      const current = await tx.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
      if (current?.status === "CONFIRMED" && current.payment?.status === "PAID" &&
          current.payment.provider === proof.provider && current.payment.providerRef === providerRef) {
        return { booking: current, changed: false };
      }
      throw new Error("Bookingen er ændret eller udløbet. Betalingen skal afstemmes.");
    }
    await tx.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        amountKr: booking.priceKr,
        platformFee: fee,
        provider: proof.provider,
        providerRef,
        status: "PAID",
      },
      update: { status: "PAID", provider: proof.provider, providerRef, amountKr: booking.priceKr, platformFee: fee },
    });
    return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId } }), changed: true };
  });
  if (result.changed) {
    try { await notifyBookingConfirmed(booking); }
    catch { console.error("Booking bekræftet, men kvittering kunne ikke sendes:", bookingId); }
  }
  return result.booking;
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

  if (booking.walletPaidOre > 0) return cancelWalletBooking(booking.userId,booking.id);
  await ensureSettings();
  if (booking.status === "CANCELLED") return null;

  const hoursUntil =
    (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
  const eligible = hoursUntil >= REFUND_WINDOW_HOURS;
  const paid = booking.payment?.status === "PAID";

  if (booking.status === "HOLD") await closeBookingCheckout(booking);
  const cancelled = await db.booking.updateMany({
    where: { id: bookingId, status: booking.status, checkoutParams: booking.checkoutParams },
    data: { status: "CANCELLED" },
  });
  if (!cancelled.count) throw new Error("Bookingen er ændret. Opdatér siden før aflysning.");

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

  // Samme for klubbens klippekort.
  if (booking.punchPurchaseId) {
    await refundPunch(booking.punchPurchaseId);
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
    where: { status: "HOLD", checkoutParams: null, holdExpiresAt: { lt: new Date() } },
    data: { status: "CANCELLED" },
  });
  const pending = await db.booking.findMany({
    where: { status: "HOLD", checkoutParams: { not: null }, holdExpiresAt: { lt: new Date() } },
  });
  for (const booking of pending) {
    try {
      if (!booking.checkoutSessionId) throw new Error("Unknown checkout result");
      const session = await (await stripe()).checkout.sessions.retrieve(booking.checkoutSessionId);
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        await confirmBookingPayment(booking.id, { provider: "stripe", session });
      } else if (session.status === "expired") {
        await db.booking.updateMany({
          where: { id: booking.id, status: "HOLD", checkoutSessionId: session.id },
          data: { status: "CANCELLED" },
        });
      }
      // Complete but unpaid means an asynchronous payment is still resolving.
      // Keep the slot reserved; never cancel solely from the local clock.
    } catch {
      console.error("Checkout kræver afstemning; reservation beholdt:", booking.id);
    }
  }
}
