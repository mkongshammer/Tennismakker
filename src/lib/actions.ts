"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { addDays, addHours, addMinutes } from "date-fns";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSettings } from "./settings";
import { COUNTRIES, LOCALES, LOCALE_LIVE, SPORTS, type Locale } from "./sports";
import { needsEmailCode, startEmailChallenge, verifyEmailChallenge } from "./twofactor";
import { completePasswordReset, requestPasswordReset } from "./password-reset";
import { eraseAccount } from "./erasure";
import { creditsWith, spendCredit, startPackageCheckout } from "./packages";
import {
  lessonEnd,
  lessonPriceKr,
  normaliseLessonMinutes,
  normaliseWeeklySlots,
} from "./slots";
import { isOffered, isTaken } from "./coaching";
import { billingPortalUrl, startSubscriptionCheckout } from "./subscription";
import { createSession, destroySession, getCurrentUser } from "./session";
import { releaseExpiredHolds, cancelAndRefund } from "./payments";
import { getClubAvailability, refreshBeforeBooking, syncClubCalendar } from "./integrations";
import { coachDecision, coachRequestNotice, matchAcceptedNotice, sendMail } from "./email";
import { loadThread, MAX_MESSAGE_LENGTH } from "./messages";
import { recordSwipe } from "./swipe";
import { createReview } from "./reviews";
import { geocode } from "./geocode";
import { setPreferenceCookies } from "./preferences";
import { detectBookingSystem, testFeed } from "./detect";
import { store as storeImage, remove as removeImage } from "./images";
import { ensureConnectAccount, createOnboardingLink, refreshAccountStatus } from "./connect";
import { rebookSameSlot } from "./rebook";

// ---------------- Auth ----------------

/**
 * En bremse på gentagne loginforsøg.
 *
 * Holdes i hukommelsen med vilje: det kræver ingen tabel, og det dækker det,
 * der faktisk sker — nogen der prøver adgangskoder i hurtig rækkefølge mod
 * den samme konto. Begrænsningen er, at tælleren nulstilles ved genstart og
 * ikke deles mellem flere servere. Kører appen en dag på flere maskiner,
 * skal den flyttes i databasen eller foran appen.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;

function tooManyAttempts(email: string): boolean {
  const entry = attempts.get(email);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailedAttempt(email: string) {
  const entry = attempts.get(email);
  const count = entry && Date.now() <= entry.until ? entry.count + 1 : 1;
  attempts.set(email, { count, until: Date.now() + LOCKOUT_MS });
}

function clearAttempts(email: string) {
  attempts.delete(email);
}

/** Mindst én gyldig sportsgren. Tennis er reserven, ikke et valg. */
function normaliseSports(input: string[]): string[] {
  const valid = input.filter((s) => (SPORTS as readonly string[]).includes(s));
  return valid.length > 0 ? valid : ["TENNIS"];
}

export async function signup(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "PLAYER");
  const level = Number(formData.get("level") ?? 3);
  const area = String(formData.get("area") ?? "").trim();

  if (!email.includes("@") || password.length < 8 || !name) {
    return { error: "Udfyld navn, gyldig e-mail og en adgangskode på mindst 8 tegn." };
  }
  if (!["PLAYER", "COACH"].includes(role)) {
    return { error: "Ugyldig rolle." };
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: "Der findes allerede en konto med den e-mail." };

  const user = await db.user.create({
    data: {
      email,
      name,
      role,
      level: Math.min(7, Math.max(1, level)),
      area: area || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  // Trænerprofilen oprettes med det, træneren selv har skrevet. Før stod
  // prisen fast på 350 kr og sportsgrenen på tennis, uanset hvem der
  // oprettede sig — og en træner, der skal rette sin egen pris bagefter,
  // opdager det først, når en elev har booket til den forkerte.
  if (role === "COACH") {
    const sports = normaliseSports(formData.getAll("sports").map(String));
    const priceHour = Math.min(5000, Math.max(50, Number(formData.get("priceHour") ?? 350)));
    const headline = String(formData.get("headline") ?? "").trim();

    await db.coachProfile.create({
      data: {
        userId: user.id,
        headline: headline || "Ny træner på RacketBuddy",
        sports: sports.join(","),
        priceHour,
        specialties: "",
        area: area || "Ukendt område",
      },
    });

    // Trænerens egne sportsgrene gælder også som spiller.
    await db.user.update({ where: { id: user.id }, data: { sports: sports.join(",") } });
  }

  await createSession(user.id);
  // Videre til det, man kom for. En ny profil er tom, så profilsiden er
  // det mindst interessante sted at lande — bookingsiden er dér, produktet
  // er.
  redirect("/book");
}

/**
 * Log ind.
 *
 * Samme svar uanset om det er mailen eller adgangskoden, der er forkert.
 * Fortæller man "den mail findes ikke", har man givet en liste over, hvem
 * der har en konto.
 *
 * For en superadmin stopper vi her og sender en kode til kontoens egen
 * mail. Sessionen oprettes først, når koden er indtastet — se
 * src/lib/twofactor.ts.
 */
export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const blocked = tooManyAttempts(email);
  if (blocked) return { error: "auth.errTooMany" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    registerFailedAttempt(email);
    return { error: "auth.errWrong" };
  }

  clearAttempts(email);

  if (needsEmailCode(user)) {
    const challengeId = await startEmailChallenge(user);
    // Id'et er ikke hemmeligt — koden er. Cookien er kortlivet, så en
    // halvfærdig login ikke ligger og venter i en browser i ugevis.
    cookies().set("rb_login", challengeId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    });
    redirect("/login/kode");
  }

  await createSession(user.id);
  redirect("/profil");
}

/** Andet trin: koden fra mailen. */
export async function verifyLoginCode(_prev: unknown, formData: FormData) {
  const challengeId = cookies().get("rb_login")?.value;
  if (!challengeId) return { error: "auth.errExpired" };

  const result = await verifyEmailChallenge(challengeId, String(formData.get("code") ?? ""));

  if (!result.ok) {
    if (result.reason !== "forkert") cookies().delete("rb_login");
    return {
      error:
        result.reason === "forkert"
          ? "auth.errCodeWrong"
          : result.reason === "opbrugt"
            ? "auth.errCodeUsed"
            : "auth.errCodeExpired",
    };
  }

  cookies().delete("rb_login");
  await createSession(result.userId);
  redirect("/superadmin");
}

/**
 * Beder om et nulstillingslink.
 *
 * Svarer det samme, uanset om mailen findes. Ellers kan siden bruges til at
 * finde ud af, hvem der har en konto.
 */
export async function askPasswordReset(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "auth.errBadEmail" };

  await requestPasswordReset(email);
  return { ok: "auth.resetSent" };
}

/** Sætter den nye adgangskode. */
export async function submitNewPassword(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password !== repeat) return { error: "auth.errNoMatch" };

  const result = await completePasswordReset(token, password);
  if (!result.ok) {
    return { error: result.reason === "kort" ? "auth.errShort" : "auth.errBadLink" };
  }

  redirect("/login?nulstillet=1");
}

/**
 * Sletter din egen konto.
 *
 * Kræver, at man skriver ordet — en knap alene er for let at ramme, og det
 * her kan ikke fortrydes. Bookinger og betalinger bliver stående, men uden
 * noget der peger på et menneske; se src/lib/erasure.ts for hvorfor.
 */
export async function deleteMyAccount(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "SLET") {
    return { error: "Skriv SLET i feltet for at bekræfte." };
  }

  await eraseAccount(user!.id);
  destroySession();
  redirect("/?slettet=1");
}

export async function logout() {
  destroySession();
  redirect("/");
}

// ---------------- Modul A: Makker-matching ----------------

export async function createMatchRequest(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const message = String(formData.get("message") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const level = Number(formData.get("level") ?? user.level);
  const matchType = String(formData.get("matchType") ?? "SINGLE");

  if (!message || !area) return { error: "Skriv en besked og et område." };

  await db.matchRequest.create({
    data: {
      message,
      area,
      level: Math.min(7, Math.max(1, level)),
      matchType,
      requesterId: user.id,
    },
  });
  revalidatePath("/makkere");
  redirect("/makkere");
}

export async function acceptMatchRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));

  const request = await db.matchRequest.findUnique({ where: { id } });
  if (!request || request.status !== "OPEN" || request.requesterId === user.id) {
    return;
  }
  await db.matchRequest.update({
    where: { id },
    data: { status: "MATCHED", acceptedById: user.id },
  });

  const owner = await db.user.findUnique({ where: { id: request.requesterId } });
  if (owner) {
    await sendMail(
      matchAcceptedNotice({
        to: owner.email,
        requesterName: owner.name,
        accepterName: user.name,
        message: request.message,
        threadId: request.id,
      })
    );
  }

  revalidatePath("/makkere");
  redirect(`/beskeder/${request.id}`);
}

export async function closeMatchRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));
  await db.matchRequest.updateMany({
    where: { id, requesterId: user.id },
    data: { status: "CLOSED" },
  });
  revalidatePath("/makkere");
  revalidatePath("/profil");
}

// ---------------- Booking (bane + træner) ----------------

const HOLD_MINUTES = 10;

/**
 * Booker en banetime: opretter HOLD og sender brugeren til checkout.
 *
 * Tiden valideres mod klubbens integration, ikke mod vores egen kalender.
 * En tid tælles kun som ledig, hvis adapteren stadig udbyder den — det er
 * det, der forhindrer os i at sælge en tid, klubbens eget system har givet væk.
 */
export async function bookCourtSlot(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const courtId = String(formData.get("courtId"));
  const startsAt = new Date(String(formData.get("startsAt")));
  const endsAt = addHours(startsAt, 1);

  const court = await db.court.findUnique({
    where: { id: courtId },
    include: { club: true },
  });
  if (!court) redirect("/book");

  const slug = court.club.slug;
  // Fejl vises som en besked på klubbens egen side, ikke som en rå
  // serverfejlside. En bruger der har trykket på en bane, skal kunne se
  // hvad der gik galt og prøve en anden tid — ikke ramme en blank fejl.
  const fail = (reason: string) => redirect(`/klub/${slug}?fejl=${reason}`);

  if (startsAt < new Date()) fail("passeret");

  await releaseExpiredHolds();
  // Hent klubbens kalender på ny, hvis spejlet er mere end et minut gammelt
  await refreshBeforeBooking(court.clubId);

  const { slots, needsClubEntry } = await getClubAvailability(
    court.clubId,
    startsAt,
    endsAt
  );
  const slot = slots.find(
    (s) => s.courtId === courtId && s.startsAt.getTime() === startsAt.getTime()
  );
  if (!slot) fail("optaget");

  const booking = await db.booking.create({
    data: {
      kind: "COURT",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: slot!.priceKr,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      courtId,
      needsClubEntry,
    },
  });

  // Bekræft at betalingen kan startes, FØR brugeren sendes videre — så en
  // klub uden Stripe-opsætning giver en pæn fejl i stedet for en blindgyde.
  //
  // Selve omdirigeringen går til vores egen /checkout-side, ikke direkte
  // til Stripes domæne. En server-redirect på tværs af domæner behandles
  // som en intern navigation af Next, og browseren kan ende med at blive
  // stående — hvorefter brugeren lander på profilen uden at have betalt.
  // Kan klubben overhovedet modtage penge? Feltet holdes opdateret af
  // Stripes account.updated-webhook, så det er billigt og troværdigt at
  // slå op — i modsætning til at oprette en session bare for at teste.
  const stripeOn = (await getSettings()).paymentProvider === "stripe";
  if (stripeOn && !court.club.stripeChargesEnabled) {
    // Reservationen må ikke blive hængende og blokere tiden for andre.
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    fail("betaling");
  }

  redirect(`/checkout/${booking.id}/start`);
}

/** Booker en trænertime. */
/** Køber et pakkeforløb hos en træner. */
export async function buyPackage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const packageId = String(formData.get("packageId") ?? "");
  const coachId = String(formData.get("coachProfileId") ?? "");

  const url = await startPackageCheckout(user!.id, packageId).catch((err) => {
    console.error("Pakkekøb fejlede:", err);
    return null;
  });

  if (!url) redirect(`/traenere/${coachId}?fejl=betaling`);
  redirect(url);
}

export async function bookCoachSlot(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const coachProfileId = String(formData.get("coachProfileId"));
  const startsAt = new Date(String(formData.get("startsAt")));

  const coach = await db.coachProfile.findUnique({ where: { id: coachProfileId } });
  if (!coach) redirect("/traenere");

  const endsAt = lessonEnd(startsAt, coach!.lessonMinutes);

  // Samme princip som ved banebooking: vis en læsbar besked på trænerens
  // side i stedet for en rå serverfejl.
  const fail = (reason: string) =>
    redirect(`/traenere/${coachProfileId}?fejl=${reason}`);

  if (coach!.userId === user.id) fail("egen");
  if (startsAt < new Date()) fail("passeret");
  // Knapperne på siden er ikke den eneste vej ind — tidspunktet skal være et,
  // træneren rent faktisk tilbyder.
  if (!isOffered(coach!, startsAt)) fail("ikke-ledig");

  await releaseExpiredHolds();

  if (await isTaken(coachProfileId, startsAt, endsAt)) fail("optaget");

  // Samme tjek som ved banebooking, se dér. Det sker FØR anmodningen
  // oprettes: en træner, der ikke kan modtage penge, skal ikke sidde og
  // godkende timer, der aldrig kan betales.
  const stripeOn = (await getSettings()).paymentProvider === "stripe";
  if (stripeOn && !coach!.stripeChargesEnabled) fail("betaling");

  // En anmodning, ikke en booking.
  //
  // En træner kan være syg, have en turnering eller bare ikke ville tage
  // netop den elev. Før blev tiden solgt, og træneren fik det at vide
  // bagefter. Nu spørger vi først, og der trækkes ingen penge, før
  // træneren har sagt ja — så en afvisning ikke skal refunderes.
  //
  // Klippet fra et pakkeforløb bruges heller ikke endnu. Det trækkes ved
  // godkendelsen, så en afvist anmodning ikke koster eleven et klip.
  const price = lessonPriceKr(coach!.priceHour, coach!.lessonMinutes);
  const credits = await creditsWith(user.id, coachProfileId);

  await db.booking.create({
    data: {
      kind: "COACH",
      status: "REQUESTED",
      startsAt,
      endsAt,
      priceKr: price,
      userId: user.id,
      coachProfileId,
    },
  });

  const coachUser = await db.user.findUnique({ where: { id: coach!.userId } });
  if (coachUser) {
    await sendMail(
      coachRequestNotice({
        to: coachUser.email,
        coachName: coachUser.name,
        playerName: user.name,
        playerLevel: user.level,
        startsAt,
        priceKr: price,
        withCredit: credits.length > 0,
      })
    );
  }

  redirect("/profil?anmodet=1");
}

export async function cancelBooking(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));

  // Kun egne bookinger, og kun dem der stadig er aktive
  const booking = await db.booking.findFirst({
    where: { id, userId: user.id, status: { in: ["REQUESTED", "HOLD", "CONFIRMED"] } },
  });
  if (!booking) return;

  await cancelAndRefund(id);
  revalidatePath("/profil");
}

// ---------------- Trænerprofil ----------------

export async function updateCoachProfile(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.coachProfile) redirect("/login");

  // Kalenderen sender et rent mønster, men mobilappen og API-klienter sender
  // rå JSON. Det renses samme sted uanset hvor det kommer fra, så ingen kan
  // gemme noget, brugerfladen ikke selv kunne have lavet.
  let weeklySlots: string;
  try {
    weeklySlots = JSON.stringify(
      normaliseWeeklySlots(JSON.parse(String(formData.get("weeklySlots") ?? "[]")))
    );
  } catch {
    return { error: "Dine ledige tider kunne ikke læses. Prøv at markere dem igen." };
  }

  await db.coachProfile.update({
    where: { userId: user.id },
    data: {
      headline: String(formData.get("headline") ?? "").trim(),
      priceHour: Math.max(0, Number(formData.get("priceHour") ?? 350)),
      lessonMinutes: normaliseLessonMinutes(formData.get("lessonMinutes")),
      specialties: String(formData.get("specialties") ?? "").trim(),
      area: String(formData.get("area") ?? "").trim(),
      weeklySlots,
    },
  });
  revalidatePath("/traenere");
  redirect("/profil");
}

// ---------------- Klub-admin: integration mod klubbens eget bookingsystem ----------------

/** Sikrer at brugeren er admin for en klub, og returnerer klub-ID'et. */
// ---------------- Klubbens abonnement ----------------

/**
 * Sender klubadministratoren til Stripe for at lægge et kort ind.
 *
 * Kaldet ligger uden for try/catch med vilje: redirect() kaster internt, og
 * en catch-alt ville sluge den — samme faldgrube som i bookingflowet.
 */
export async function startClubSubscription() {
  const { clubId } = await requireClubAdmin();
  const url = await startSubscriptionCheckout(clubId).catch((err) => {
    console.error("Abonnementet kunne ikke startes:", err);
    return null;
  });
  if (!url) redirect("/admin?abonnement=fejl");
  redirect(url);
}

/** Åbner Stripes kundeportal: skift kort, se fakturaer, opsig. */
export async function openClubBillingPortal() {
  const { clubId } = await requireClubAdmin();
  const url = await billingPortalUrl(clubId).catch((err) => {
    console.error("Kundeportalen kunne ikke åbnes:", err);
    return null;
  });
  if (!url) redirect("/admin?abonnement=portal");
  redirect(url);
}

async function requireClubAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    throw new Error("Kun klub-administratorer har adgang til dette.");
  }
  return { user, clubId: user.clubId as string };
}

export async function updateIntegration(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const integrationType = String(formData.get("integrationType") ?? "NATIVE");
  if (!["NATIVE", "MANUAL", "ICAL", "API"].includes(integrationType)) {
    return { error: "Ukendt integrationstype." };
  }

  const icalUrl = String(formData.get("icalUrl") ?? "").trim();
  if (integrationType === "ICAL") {
    if (!icalUrl) return { error: "Angiv en feed-adresse, når du vælger kalenderfeed." };
    if (!/^https?:\/\//i.test(icalUrl)) {
      return { error: "Feed-adressen skal starte med http:// eller https://" };
    }
  }

  await db.club.update({
    where: { id: clubId },
    data: {
      integrationType,
      icalUrl: integrationType === "ICAL" ? icalUrl : null,
      externalSystem: String(formData.get("externalSystem") ?? "").trim() || null,
      lastSyncError: null,
    },
  });

  revalidatePath("/admin");
  return { ok: "Integration gemt." };
}

export async function syncNow() {
  const { clubId } = await requireClubAdmin();
  await syncClubCalendar(clubId);
  revalidatePath("/admin");
}

/**
 * Frigiver gæstetider (MANUAL-integration): klubben vælger bane, dato,
 * tidsrum og pris, og vi opretter én time ad gangen i det interval.
 */

/**
 * Klubber med eget bookingsystem skal spærre tiden dér, FØR den frigives
 * hos os. Det er den ene regel, der gør dobbeltbooking umulig.
 *
 * Den omvendte rækkefølge — frigiv hos os, før ind i Halbooking bagefter —
 * har et tidsvindue, hvor et medlem kan nå at booke samme time i klubbens
 * system. Med spærringen først findes tiden kun ét sted: hos os.
 *
 * Derfor kræver vi et aktivt ja, og serveren stoler ikke på, at knappen
 * var der. Halbooking har ingen grænseflade, vi kan skrive til, så det
 * her er ikke en formalitet — det er hele beskyttelsen.
 */
async function requireBlockedFirst(clubId: string, formData: FormData): Promise<string | null> {
  const club = await db.club.findUnique({
    where: { id: clubId },
    select: { integrationType: true, externalSystem: true },
  });
  const hasOwnSystem = club && club.integrationType !== "NATIVE";
  if (!hasOwnSystem) return null;
  if (formData.get("blockedFirst") === "on") return null;
  return `Spær tiderne i ${club!.externalSystem ?? "jeres eget bookingsystem"} først, og sæt så flueben. Ellers kan et medlem nå at booke samme time dér.`;
}

export async function releaseGuestSlots(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const courtId = String(formData.get("courtId") ?? "");
  const date = String(formData.get("date") ?? "");
  const fromHour = Number(formData.get("fromHour") ?? 0);
  const toHour = Number(formData.get("toHour") ?? 0);
  const priceKr = Number(formData.get("priceKr") ?? 0);

  const blocked = await requireBlockedFirst(clubId, formData);
  if (blocked) return { error: blocked };

  const court = await db.court.findFirst({ where: { id: courtId, clubId } });
  if (!court) return { error: "Vælg en bane, der hører til klubben." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Vælg en dato." };
  if (!(fromHour >= 0 && toHour <= 24 && fromHour < toHour)) {
    return { error: "Sluttidspunktet skal ligge efter starttidspunktet." };
  }
  if (!(priceKr >= 0)) return { error: "Angiv en pris på 0 kr eller derover." };

  const [y, m, d] = date.split("-").map(Number);
  let created = 0;
  for (let h = fromHour; h < toHour; h++) {
    const startsAt = new Date(y, m - 1, d, h, 0, 0, 0);
    const endsAt = new Date(y, m - 1, d, h + 1, 0, 0, 0);
    if (startsAt < new Date()) continue;
    try {
      await db.guestSlot.create({ data: { courtId, startsAt, endsAt, priceKr } });
      created++;
    } catch {
      // Tiden var allerede frigivet — spring over (unique på courtId+startsAt)
    }
  }

  revalidatePath("/admin");
  return created > 0
    ? { ok: `${created} tider frigivet til gæster.` }
    : { error: "Ingen nye tider blev frigivet — de var allerede frigivet eller ligger i fortiden." };
}

export async function withdrawGuestSlot(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("id"));
  const slot = await db.guestSlot.findFirst({
    where: { id, court: { clubId } },
  });
  if (slot) await db.guestSlot.delete({ where: { id } });
  revalidatePath("/admin");
}

/** Markerer en booking som ført ind i klubbens eget bookingsystem. */
export async function markClubEntered(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("id"));
  await db.booking.updateMany({
    where: { id, court: { clubId } },
    data: { clubEnteredAt: new Date() },
  });
  revalidatePath("/admin");
}

// ---------------- Klub-selvbetjening ----------------

/** Laver et URL-venligt slug ud fra klubnavnet. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// ---------------- Klub-kontakt (erstatter selvbetjent oprettelse) ----------------
//
// Klubber kan ikke længere oprette sig selv. De sender en henvendelse her,
// og platformens ejer opretter den fulde profil manuelt fra /superadmin.
// Det er bevidst: selvbetjening var netop det, den manuelle godkendelse
// skulle beskytte imod, så nu findes oprettelsen slet ikke offentligt.

export async function submitClubLead(_prev: unknown, formData: FormData) {
  const clubName = String(formData.get("clubName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!clubName || !city) return { error: "Udfyld klubbens navn og by." };
  if (!contactName || !email.includes("@")) {
    return { error: "Udfyld dit navn og en gyldig e-mail." };
  }

  const lead = await db.clubLead.create({
    data: { clubName, city, contactName, email, phone: phone || null, message: message || null },
  });

  await sendMail({
    to: email,
    subject: `Vi har jeres henvendelse — ${clubName}`,
    body: [
      `Hej ${contactName}`,
      ``,
      `Tak for interessen i RacketBuddy. Vi vender tilbage og sætter jeres`,
      `klub op, så snart vi har talt sammen.`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  });

  const inbox = (await getSettings()).ordersEmail;
  if (inbox) {
    await sendMail({
      to: inbox,
      subject: `Ny klubhenvendelse: ${clubName}`,
      body: [
        `${clubName}, ${city}`,
        `${contactName} · ${email}${phone ? ` · ${phone}` : ""}`,
        ``,
        message || "Ingen besked.",
        ``,
        `${(await getSettings()).appUrl}/superadmin`,
      ].join("\n"),
    });
  }

  return {
    ok: `Tak — vi vender tilbage til ${contactName} snarest. Henvendelsesnummer ${lead.id.slice(-6).toUpperCase()}.`,
  };
}

export async function updateLeadStatus(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["NEW", "CONTACTED", "CONVERTED", "DECLINED"].includes(status)) return;
  await db.clubLead.update({ where: { id }, data: { status } });
  revalidatePath("/superadmin");
}

/**
 * Opretter en fuld klubprofil — kun platformens ejer kan gøre det. Klubben
 * får automatisk en administratorkonto med en midlertidig adgangskode,
 * som sendes på mail. Godkendes med det samme: det er ejeren selv, der nu
 * står inde for, at klubben er ægte, så den separate godkendelseskø er
 * unødvendig for klubber oprettet ad denne vej.
 */
export async function createClubAsAdmin(_prev: unknown, formData: FormData) {
  await requireSuperadmin();

  const clubName = String(formData.get("clubName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const courtCount = Number(formData.get("courtCount") ?? 0);
  const priceHour = Number(formData.get("priceHour") ?? 0);
  const externalSystem = String(formData.get("externalSystem") ?? "").trim();
  const billingModel =
    String(formData.get("billingModel")) === "SUBSCRIPTION" ? "SUBSCRIPTION" : "COMMISSION";

  const adminName = String(formData.get("adminName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  const leadId = String(formData.get("leadId") ?? "").trim();

  if (!clubName || !city) return { error: "Udfyld klubbens navn og by." };
  if (!(courtCount >= 1 && courtCount <= 40)) {
    return { error: "Antal baner skal være mellem 1 og 40." };
  }
  if (!(priceHour >= 0)) return { error: "Angiv en pris på 0 kr eller derover." };
  if (!adminName || !adminEmail.includes("@")) {
    return { error: "Udfyld administratorens navn og en gyldig e-mail." };
  }
  if (await db.user.findUnique({ where: { email: adminEmail } })) {
    return { error: "Der findes allerede en konto med den e-mail." };
  }

  const base = slugify(clubName) || "klub";
  let slug = base;
  for (let i = 2; await db.club.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const coords = address ? await geocode(address, city) : null;

  const club = await db.club.create({
    data: {
      slug,
      name: clubName,
      city,
      address: address || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      priceHour,
      integrationType: "MANUAL",
      externalSystem: externalSystem || null,
      billingModel,
      country: "DK",
      status: "APPROVED",
      approvedAt: new Date(),
      courts: {
        create: Array.from({ length: courtCount }, (_, i) => ({
          name: `Bane ${i + 1}`,
          sport: "TENNIS",
          surface: "GRUS",
        })),
      },
    },
  });

  // En midlertidig adgangskode — klubben skifter den selv efter første login
  const tempPassword = crypto.randomBytes(6).toString("base64url");
  const admin = await db.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      role: "CLUB_ADMIN",
      clubId: club.id,
      area: city,
    },
  });

  if (leadId) {
    await db.clubLead.update({
      where: { id: leadId },
      data: { status: "CONVERTED", clubId: club.id },
    }).catch(() => null);
  }

  await sendMail({
    to: adminEmail,
    subject: `${clubName} er oprettet på RacketBuddy`,
    body: [
      `Hej ${adminName}`,
      ``,
      `${clubName} er oprettet. Log ind og se jeres side her:`,
      ``,
      `${(await getSettings()).appUrl}/login`,
      `E-mail: ${adminEmail}`,
      `Midlertidig adgangskode: ${tempPassword}`,
      ``,
      `Skift adgangskoden under din profil, når du er logget ind.`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  });

  revalidatePath("/superadmin");
  return { ok: `${clubName} er oprettet. Login er sendt til ${adminEmail}.` };
}


// ---------------- Beskeder ----------------

export async function sendMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const matchRequestId = String(formData.get("matchRequestId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  if (body.length > MAX_MESSAGE_LENGTH) return;

  const access = await loadThread(matchRequestId, user.id);
  if (!access.ok) return;

  await db.message.create({
    data: { matchRequestId, senderId: user.id, body },
  });

  revalidatePath(`/beskeder/${matchRequestId}`);
  revalidatePath("/beskeder");
}

// ---------------- Swipe ----------------

export async function submitSwipe(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const toUserId = String(formData.get("toUserId"));
  const liked = String(formData.get("liked")) === "1";

  const result = await recordSwipe(user.id, toUserId, liked);
  if (result.matched && result.threadId) {
    redirect(`/beskeder/${result.threadId}?nyt=1`);
  }
  revalidatePath("/spillere");
}

// ---------------- Trænerens svar på en anmodning ----------------

/** Trænerprofilen for den, der er logget ind. Kaster, hvis der ikke er en. */
async function requireOwnCoachProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const coach = await db.coachProfile.findUnique({ where: { userId: user!.id } });
  if (!coach) redirect("/profil");
  return coach!;
}

/**
 * Træneren siger ja.
 *
 * Har eleven et klippekort, bruges klippet her — og først her. Ellers får
 * eleven et døgn til at betale, hvorefter tiden frigives igen.
 */
export async function approveCoachBooking(formData: FormData) {
  const coach = await requireOwnCoachProfile();
  const id = String(formData.get("bookingId") ?? "");

  const booking = await db.booking.findFirst({
    where: { id, coachProfileId: coach.id, status: "REQUESTED" },
    include: { user: true, coachProfile: { include: { user: true } } },
  });
  if (!booking) redirect("/profil/traener");

  const credit = await spendCredit(booking!.userId, coach.id);

  const updated = await db.booking.update({
    where: { id: booking!.id },
    data: credit
      ? { status: "CONFIRMED", priceKr: 0, packagePurchaseId: credit, holdExpiresAt: null }
      : { status: "HOLD", holdExpiresAt: addHours(new Date(), 24) },
  });

  await sendMail(
    coachDecision({
      to: booking!.user.email,
      playerName: booking!.user.name,
      coachName: booking!.coachProfile!.user.name,
      startsAt: booking!.startsAt,
      approved: true,
      paidWithCredit: Boolean(credit),
      bookingId: updated.id,
    })
  );

  revalidatePath("/profil/traener");
  redirect("/profil/traener?svar=godkendt");
}

/** Træneren siger nej. Der er ingenting at refundere, fordi der ikke er betalt. */
export async function declineCoachBooking(formData: FormData) {
  const coach = await requireOwnCoachProfile();
  const id = String(formData.get("bookingId") ?? "");

  const booking = await db.booking.findFirst({
    where: { id, coachProfileId: coach.id, status: "REQUESTED" },
    include: { user: true, coachProfile: { include: { user: true } } },
  });
  if (!booking) redirect("/profil/traener");

  await db.booking.update({ where: { id: booking!.id }, data: { status: "CANCELLED" } });

  await sendMail(
    coachDecision({
      to: booking!.user.email,
      playerName: booking!.user.name,
      coachName: booking!.coachProfile!.user.name,
      startsAt: booking!.startsAt,
      approved: false,
      paidWithCredit: false,
      bookingId: booking!.id,
    })
  );

  revalidatePath("/profil/traener");
  redirect("/profil/traener?svar=afvist");
}

// ---------------- Anmeldelser ----------------

export async function submitReview(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await createReview(
    user.id,
    String(formData.get("bookingId")),
    Number(formData.get("rating") ?? 0),
    String(formData.get("comment") ?? "")
  );

  if (!result.ok) return { error: result.error };

  revalidatePath("/profil");
  revalidatePath("/traenere");
  revalidatePath("/klubber");
  return { ok: "Tak for din anmeldelse." };
}

// ---------------- Klubgodkendelse (superadmin) ----------------

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    throw new Error("Kun RacketBuddy-administratorer har adgang til dette.");
  }
  return user;
}

export async function approveClub(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id"));

  const club = await db.club.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), reviewNote: null },
    include: { members: true },
  });

  // Fortæl klubben at de er på
  for (const admin of club.members.filter((m: any) => m.role === "CLUB_ADMIN")) {
    await sendMail({
      to: admin.email,
      subject: `${club.name} er nu på RacketBuddy`,
      body: [
        `Hej ${admin.name}`,
        ``,
        `${club.name} er godkendt og synlig for spillere.`,
        ``,
        `Næste schalk: frigiv de tider, gæster må booke.`,
        `${(await getSettings()).appUrl}/admin`,
        ``,
        `RacketBuddy`,
      ].join("\n"),
    });
  }

  revalidatePath("/superadmin");
  revalidatePath("/book");
}

export async function rejectClub(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim();

  await db.club.update({
    where: { id },
    data: { status: "REJECTED", reviewNote: note || null },
  });

  revalidatePath("/superadmin");
}

// ---------------- Trænerpakker ----------------

export async function createPackage(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.coachProfile) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const sessions = Number(formData.get("sessions") ?? 0);
  const priceKr = Number(formData.get("priceKr") ?? 0);
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "Giv pakken et navn." };
  if (!(sessions >= 1 && sessions <= 100)) {
    return { error: "Antal timer skal være mellem 1 og 100." };
  }
  if (!(priceKr > 0)) return { error: "Angiv en samlet pris." };

  await db.coachPackage.create({
    data: {
      coachProfileId: user.coachProfile.id,
      name,
      sessions,
      priceKr,
      description: description || null,
    },
  });

  revalidatePath("/profil/traener");
  revalidatePath("/traenere");
  return { ok: "Pakken er oprettet." };
}

export async function togglePackage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.coachProfile) redirect("/login");

  const id = String(formData.get("id"));
  const pkg = await db.coachPackage.findFirst({
    where: { id, coachProfileId: user.coachProfile.id },
  });
  if (!pkg) return;

  await db.coachPackage.update({
    where: { id },
    data: { active: !pkg.active },
  });
  revalidatePath("/profil/traener");
  revalidatePath("/traenere");
}

// ---------------- Opsætning: land, sprog, sportsgren ----------------

export async function updatePreferences(formData: FormData) {
  const country = String(formData.get("country") ?? "DK");
  const locale = String(formData.get("locale") ?? "da");
  const sport = String(formData.get("sport") ?? "TENNIS");

  setPreferenceCookies({ country, locale: locale as any, sport: sport as any });

  const user = await getCurrentUser();
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { country, locale },
    });
  }

  revalidatePath("/", "layout");
}

/** Skifter valgt sportsgren. Gemmes i cookie, så det følger med rundt. */
/**
 * Vælger land — og dermed hvilke klubber, priser og hvilket sprog man møder.
 *
 * Sproget følger med landet, men kun hvis man ikke allerede har valgt et
 * selv. Har man skiftet sprog i footeren først, er det et bevidst valg, og
 * det skal et landevalg ikke kunne trumfe.
 */
export async function setCountry(formData: FormData) {
  const code = String(formData.get("country") ?? "");
  const country = COUNTRIES.find((c) => c.code === code);
  // Ikke bare "findes landet", men "sælger vi der". Ellers kan man sætte
  // sig selv til et marked, hvor der ikke findes en eneste bane.
  if (!country?.live) return;

  const alreadyPickedLanguage = Boolean(cookies().get("rb_prefs_locale")?.value);
  const locale = alreadyPickedLanguage ? undefined : (country.defaultLocale as any);

  setPreferenceCookies({ country: country.code, ...(locale ? { locale } : {}) });

  const user = await getCurrentUser();
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: {
        country: country.code,
        countryChosen: true,
        ...(locale ? { locale } : {}),
      },
    });
  }

  revalidatePath("/", "layout");
}

/**
 * Lukker spørgsmålet uden at svare.
 *
 * Vi beholder standarden og spørger ikke igen. At blokere siden, indtil
 * nogen har valgt, ville koste flere besøgende end det forkerte land gør —
 * og landet kan skiftes i footeren når som helst.
 */
export async function dismissCountryChoice() {
  setPreferenceCookies({ country: "DK" });

  const user = await getCurrentUser();
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { countryChosen: true } });
  }

  revalidatePath("/", "layout");
}

/**
 * Skifter sprog.
 *
 * Gemmes i en cookie, ikke i URL'en. Et sprogvalg er en indstilling, ikke en
 * adresse: den samme klubside skal kunne deles med naboen, uanset hvilket
 * sprog hver af jer læser den på. Er man logget ind, ligger valget desuden
 * på brugeren og følger med til telefonen.
 */
export async function setLocale(formData: FormData) {
  const value = String(formData.get("locale") ?? "da");
  if (!(LOCALES as readonly string[]).includes(value)) return;
  // Sprog for markeder, vi ikke er i, kan ses men ikke vælges.
  if (!LOCALE_LIVE[value as Locale]) return;

  setPreferenceCookies({ locale: value as any });

  const user = await getCurrentUser();
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { locale: value } });
  }

  revalidatePath("/", "layout");
}

export async function setSport(formData: FormData) {
  const sport = String(formData.get("sport") ?? "TENNIS");
  setPreferenceCookies({ sport: sport as any });
  revalidatePath("/", "layout");
}

// ---------------- Gentag en booking ----------------
//
// Ketsjersport er en vane, ikke et impulskøb: folk spiller samme ugedag,
// samme tid, ofte mod den samme. Det er dér fastholdelsen ligger — ikke i
// nedtællinger og "kun 1 tilbage".
//
// Derfor gør vi den gentagelse til ét tryk. Alt andet — knaphed, hastværk,
// notifikationer der lokker — koster tillid og er i EU ulovligt, hvis det
// ikke er sandt.

/** Finder samme ugedag og klokkeslæt næste uge. */
export async function rebookNextWeek(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await rebookSameSlot(user.id, String(formData.get("bookingId")));

  if (!result.ok) {
    if (result.reason === "taken") {
      redirect(`/klub/${result.clubSlug}?dag=${result.dayOffset}&optaget=1`);
    }
    redirect("/book");
  }

  redirect(result.checkoutUrl);
}

// ---------------- Klubopsætning: find systemet, sæt regler ----------------

export async function detectClubSystem(_prev: unknown, formData: FormData) {
  const url = String(formData.get("website") ?? "").trim();
  if (!url) return { error: "Skriv jeres hjemmeside." };
  return { detection: await detectBookingSystem(url) };
}

export async function testClubFeed(_prev: unknown, formData: FormData) {
  await requireClubAdmin();
  const url = String(formData.get("icalUrl") ?? "").trim();
  if (!url) return { error: "Skriv feedets adresse." };
  const result = await testFeed(url);
  return result.ok ? { ok: result.message } : { error: result.message };
}

/** Opretter en frigivelsesregel: baner, ugedage, tidsrum og pris. */
export async function createRule(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const days = formData.getAll("days").map(String).filter(Boolean);
  const courtIds = formData.getAll("courts").map(String).filter(Boolean);
  const fromHour = Number(formData.get("fromHour") ?? 0);
  const toHour = Number(formData.get("toHour") ?? 0);
  const priceKr = Number(formData.get("priceKr") ?? 0);

  const blocked = await requireBlockedFirst(clubId, formData);
  if (blocked) return { error: blocked };

  if (days.length === 0) return { error: "Vælg mindst én ugedag." };
  if (!(fromHour >= 0 && toHour <= 24 && fromHour < toHour)) {
    return { error: "Sluttidspunktet skal ligge efter starttidspunktet." };
  }
  if (!(priceKr >= 0)) return { error: "Angiv en pris." };

  await db.guestRule.create({
    data: {
      clubId,
      // Tom liste betyder alle baner — så behøver klubben ikke vælge hver gang
      courtIds: courtIds.join(","),
      daysOfWeek: days.join(","),
      fromHour,
      toHour,
      priceKr,
    },
  });

  revalidatePath("/admin");
  return { ok: "Reglen er aktiv. Tiderne er nu synlige for gæster." };
}

export async function toggleRule(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("id"));
  const rule = await db.guestRule.findFirst({ where: { id, clubId } });
  if (!rule) return;
  await db.guestRule.update({ where: { id }, data: { active: !rule.active } });
  revalidatePath("/admin");
}

export async function deleteRule(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("id"));
  await db.guestRule.deleteMany({ where: { id, clubId } });
  revalidatePath("/admin");
}

/** Frigiv automatisk alt der stadig er ledigt tæt på spilletidspunktet. */
export async function setLastMinute(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const hours = Math.max(0, Math.min(72, Number(formData.get("hours") ?? 0)));
  await db.club.update({ where: { id: clubId }, data: { lastMinuteHours: hours } });
  revalidatePath("/admin");
}

// ---------------- Klubbens hjemmeside ----------------
//
// Klubber der bruger os som deres eneste system har ingen anden
// hjemmeside. Så det, de skriver her, ER klubbens ansigt udadtil.

export async function updateClubSite(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const color = String(formData.get("color") ?? "").trim();
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Farven skal skrives som en hex-kode, fx #1B62C4." };
  }

  const openHour = Number(formData.get("openHour") ?? 7);
  const closeHour = Number(formData.get("closeHour") ?? 22);
  if (!(openHour >= 0 && closeHour <= 24 && openHour < closeHour)) {
    return { error: "Lukketid skal ligge efter åbningstid." };
  }

  const memberPriceRaw = String(formData.get("memberPriceHour") ?? "").trim();
  const memberPriceHour = memberPriceRaw === "" ? null : Number(memberPriceRaw);
  if (memberPriceHour !== null && !(memberPriceHour >= 0)) {
    return { error: "Medlemsprisen skal være 0 kr eller derover." };
  }

  const hasLock = formData.get("hasLock") === "on";
  const accessCode = String(formData.get("accessCode") ?? "").trim();
  const accessInstructions = String(formData.get("accessInstructions") ?? "").trim();

  await db.club.update({
    where: { id: clubId },
    data: {
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      about: String(formData.get("about") ?? "").trim() || null,
      practicalInfo: String(formData.get("practicalInfo") ?? "").trim() || null,
      contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
      contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
      priceHour: Math.max(0, Number(formData.get("priceHour") ?? 0)),
      memberPriceHour,
      openHour,
      closeHour,
      hasLock,
      accessCode: accessCode || null,
      accessInstructions: accessInstructions || null,
      ...(color ? { color } : {}),
    },
  });

  revalidatePath("/admin");
  return { ok: "Siden er opdateret." };
}

export async function createPost(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { error: "Udfyld både overskrift og tekst." };

  await db.clubPost.create({
    data: { clubId, title, body, pinned: formData.get("pinned") === "on" },
  });

  revalidatePath("/admin");
  return { ok: "Nyheden er slået op." };
}

export async function deletePost(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  await db.clubPost.deleteMany({
    where: { id: String(formData.get("id")), clubId },
  });
  revalidatePath("/admin");
}

/** Genererer en tilmeldingskode, klubben kan dele med sine medlemmer. */
export async function generateJoinCode() {
  const { clubId } = await requireClubAdmin();
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) return;

  const base = club.slug.split("-")[0].toUpperCase().slice(0, 6);
  let code = "";
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await db.club.findUnique({ where: { joinCode: candidate } }))) {
      code = candidate;
      break;
    }
  }
  if (!code) return;

  await db.club.update({ where: { id: clubId }, data: { joinCode: code } });
  revalidatePath("/admin");
}

/** Melder den indloggede bruger ind i klubben med koden. */
export async function joinClub(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Skriv koden fra klubben." };

  const club = await db.club.findUnique({ where: { joinCode: code } });
  if (!club) return { error: "Koden passer ikke til nogen klub." };
  if (user.clubId === club.id) return { ok: "Du er allerede medlem." };

  await db.user.update({ where: { id: user.id }, data: { clubId: club.id } });
  revalidatePath(`/klub/${club.slug}`);
  redirect(`/klub/${club.slug}`);
}

// ---------------- Hjemmeside som ydelse ----------------

export async function orderWebsite(_prev: unknown, formData: FormData) {
  const clubName = String(formData.get("clubName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clubName || !contactName) return { error: "Udfyld klubbens navn og dit navn." };
  if (!email.includes("@")) return { error: "Skriv en gyldig e-mail." };

  const order = await db.websiteOrder.create({
    data: {
      clubName,
      contactName,
      email,
      phone: phone || null,
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, "") || null,
      notes: notes || null,
    },
  });

  // Kvittering til klubben, så de ved at den er landet
  await sendMail({
    to: email,
    subject: `Vi har jeres bestilling — ${clubName}`,
    body: [
      `Hej ${contactName}`,
      ``,
      `Tak for bestillingen. Vi ringer inden for et par hverdage og taler om,`,
      `hvad klubben har brug for.`,
      ``,
      `Opsætningen koster 5.000 kr, og vi opkræver først, når I har set et`,
      `udkast og sagt ja.`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  });

  // Besked til os
  const inbox = (await getSettings()).ordersEmail;
  if (inbox) {
    await sendMail({
      to: inbox,
      subject: `Ny hjemmesidebestilling: ${clubName}`,
      body: [
        `${clubName}`,
        `${contactName} · ${email}${phone ? ` · ${phone}` : ""}`,
        domain ? `Domæne: ${domain}` : `Domæne: har ikke et`,
        ``,
        notes || "Ingen bemærkninger.",
        ``,
        `${(await getSettings()).appUrl}/superadmin`,
      ].join("\n"),
    });
  }

  return {
    ok: `Vi ringer til ${contactName} inden for et par hverdage. Bestillingsnummer ${order.id.slice(-6).toUpperCase()}.`,
  };
}

export async function updateOrderStatus(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["NEW", "CONTACTED", "BUILDING", "LIVE", "CANCELLED"].includes(status)) return;

  await db.websiteOrder.update({ where: { id }, data: { status } });
  revalidatePath("/superadmin");
}

/**
 * Kobler et domæne på en klub.
 *
 * Domænet virker først, når klubben har peget sit DNS mod os, og når
 * domænet er tilføjet hos hostingudbyderen. Begge dele er manuelt arbejde
 * — det er blandt andet det, opsætningsgebyret dækker.
 */
export async function setCustomDomain(_prev: unknown, formData: FormData) {
  await requireSuperadmin();

  const clubId = String(formData.get("clubId") ?? "").trim();
  const domain = String(formData.get("domain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  if (!clubId) return { error: "Vælg en klub." };
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { error: "Det ser ikke ud som et gyldigt domæne." };
  }

  const taken = domain
    ? await db.club.findFirst({ where: { customDomain: domain, NOT: { id: clubId } } })
    : null;
  if (taken) return { error: "Domænet er allerede knyttet til en anden klub." };

  await db.club.update({
    where: { id: clubId },
    data: {
      customDomain: domain || null,
      domainStatus: domain ? "PENDING_DNS" : "NONE",
    },
  });

  revalidatePath("/superadmin");
  return {
    ok: domain
      ? `${domain} er registreret. Peg klubbens DNS mod os, tilføj domænet hos hostingudbyderen, og sæt status til aktiv.`
      : "Domænet er fjernet.",
  };
}

export async function markDomainLive(formData: FormData) {
  await requireSuperadmin();
  await db.club.update({
    where: { id: String(formData.get("clubId")) },
    data: { domainStatus: "LIVE" },
  });
  revalidatePath("/superadmin");
}

/** Skifter klubbens tema. */
export async function setTheme(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const theme = String(formData.get("theme"));
  if (!["KLASSISK", "MARKANT", "ENKEL"].includes(theme)) return;
  await db.club.update({ where: { id: clubId }, data: { theme } });
  revalidatePath("/admin");
}

// ---------------- Billeder ----------------

export async function uploadImage(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const kind = String(formData.get("kind") ?? "PHOTO");
  if (!["LOGO", "HERO", "PHOTO"].includes(kind)) {
    return { error: "Ukendt billedtype." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Vælg en fil." };

  const result = await storeImage(
    clubId,
    kind as "LOGO" | "HERO" | "PHOTO",
    file,
    String(formData.get("alt") ?? "")
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin");
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (club) revalidatePath(`/klub/${club.slug}`);

  return { ok: "Billedet er uploadet." };
}

export async function deleteImage(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  await removeImage(clubId, String(formData.get("id")));

  revalidatePath("/admin");
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (club) revalidatePath(`/klub/${club.slug}`);
}

// ---------------- Stripe Connect: udbetalinger til klub og træner ----------------

/** Opretter (om nødvendigt) en Stripe-konto og sender klubben videre til opsætning. */
export async function startClubPayoutSetup() {
  const { clubId } = await requireClubAdmin();
  const accountId = await ensureConnectAccount("CLUB", clubId);
  const url = await createOnboardingLink(
    accountId,
    "/admin?stripe=return",
    "/admin?stripe=refresh"
  );
  redirect(url);
}

/** Samme som ovenfor, for trænere. */
export async function startCoachPayoutSetup() {
  const user = await getCurrentUser();
  if (!user?.coachProfile) redirect("/login");
  const accountId = await ensureConnectAccount("COACH", user.coachProfile.id);
  const url = await createOnboardingLink(
    accountId,
    "/profil/traener?stripe=return",
    "/profil/traener?stripe=refresh"
  );
  redirect(url);
}

// ---------------- Adgangskode ----------------

export async function changePassword(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "Nuværende adgangskode er forkert." };
  }
  if (next.length < 8) return { error: "Den nye adgangskode skal være mindst 8 tegn." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  return { ok: "Adgangskoden er skiftet." };
}
