"use server";

import bcrypt from "bcryptjs";
import { addDays, addHours, addMinutes } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { createSession, destroySession, getCurrentUser } from "./session";
import { startCheckout, releaseExpiredHolds, cancelAndRefund } from "./payments";
import { getClubAvailability, refreshBeforeBooking, syncClubCalendar } from "./integrations";
import { matchAcceptedNotice, sendMail } from "./email";
import { loadThread, MAX_MESSAGE_LENGTH } from "./messages";
import { recordSwipe } from "./swipe";
import { createReview } from "./reviews";
import { geocode } from "./geocode";
import { setPreferenceCookies } from "./preferences";
import { detectBookingSystem, testFeed } from "./detect";

// ---------------- Auth ----------------

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

  // Trænere får automatisk en tom trænerprofil de kan udfylde
  if (role === "COACH") {
    await db.coachProfile.create({
      data: {
        userId: user.id,
        headline: "Ny træner på RacketBuddy",
        priceHour: 350,
        specialties: "",
        area: area || "Ukendt område",
      },
    });
  }

  await createSession(user.id);
  redirect("/profil");
}

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Forkert e-mail eller adgangskode." };
  }
  await createSession(user.id);
  redirect("/profil");
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

// ---------------- Booking (ink + træner) ----------------

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
  if (!court) throw new Error("Banen findes ikke");
  if (startsAt < new Date()) throw new Error("Tidspunktet er passeret");

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
  if (!slot) {
    throw new Error("Tiden er ikke længere ledig — vælg en anden.");
  }

  const booking = await db.booking.create({
    data: {
      kind: "COURT",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: slot.priceKr,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      courtId,
      needsClubEntry,
    },
  });

  redirect(await startCheckout(booking.id));
}

/** Booker en trænertime. */
export async function bookCoachSlot(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const coachProfileId = String(formData.get("coachProfileId"));
  const startsAt = new Date(String(formData.get("startsAt")));
  const endsAt = addHours(startsAt, 1);

  const coach = await db.coachProfile.findUnique({ where: { id: coachProfileId } });
  if (!coach) throw new Error("Træneren findes ikke");
  if (coach.userId === user.id) throw new Error("Du kan ikke booke dig selv");
  if (startsAt < new Date()) throw new Error("Tidspunktet er passeret");

  await releaseExpiredHolds();

  const clash = await db.booking.findFirst({
    where: { coachProfileId, startsAt, status: { in: ["HOLD", "CONFIRMED"] } },
  });
  if (clash) throw new Error("Tiden er lige blevet taget — vælg en anden.");

  const booking = await db.booking.create({
    data: {
      kind: "COACH",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: coach.priceHour,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      coachProfileId,
    },
  });

  redirect(await startCheckout(booking.id));
}

export async function cancelBooking(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id"));

  // Kun egne bookinger, og kun dem der stadig er aktive
  const booking = await db.booking.findFirst({
    where: { id, userId: user.id, status: { in: ["HOLD", "CONFIRMED"] } },
  });
  if (!booking) return;

  await cancelAndRefund(id);
  revalidatePath("/profil");
}

// ---------------- Trænerprofil ----------------

export async function updateCoachProfile(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.coachProfile) redirect("/login");

  const weeklySlotsRaw = String(formData.get("weeklySlots") ?? "[]");
  try {
    const parsed = JSON.parse(weeklySlotsRaw);
    if (!Array.isArray(parsed)) throw new Error();
  } catch {
    return { error: "Ledige tider skal være gyldig JSON, fx [{\"day\":2,\"from\":16,\"to\":20}]" };
  }

  await db.coachProfile.update({
    where: { userId: user.id },
    data: {
      headline: String(formData.get("headline") ?? "").trim(),
      priceHour: Math.max(0, Number(formData.get("priceHour") ?? 350)),
      specialties: String(formData.get("specialties") ?? "").trim(),
      area: String(formData.get("area") ?? "").trim(),
      weeklySlots: weeklySlotsRaw,
    },
  });
  revalidatePath("/traenere");
  redirect("/profil");
}

// ---------------- Klub-admin: integration mod klubbens eget bookingsystem ----------------

/** Sikrer at brugeren er admin for en klub, og returnerer klub-ID'et. */
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
 * Frigiver gæstetider (MANUAL-integration): klubben vælger ink, dato,
 * tidsrum og pris, og vi opretter én time ad gangen i det interval.
 */
export async function releaseGuestSlots(_prev: unknown, formData: FormData) {
  const { clubId } = await requireClubAdmin();

  const courtId = String(formData.get("courtId") ?? "");
  const date = String(formData.get("date") ?? "");
  const fromHour = Number(formData.get("fromHour") ?? 0);
  const toHour = Number(formData.get("toHour") ?? 0);
  const priceKr = Number(formData.get("priceKr") ?? 0);

  const court = await db.court.findFirst({ where: { id: courtId, clubId } });
  if (!court) return { error: "Vælg en ink der hører til klubben." };
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

/**
 * Opretter en klub og en admin-konto i én omgang, så en bestyrelse kan
 * komme i gang uden at vi skal ind over.
 */
export async function createClub(_prev: unknown, formData: FormData) {
  const clubName = String(formData.get("clubName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const courtCount = Number(formData.get("courtCount") ?? 0);
  const priceHour = Number(formData.get("priceHour") ?? 0);
  const externalSystem = String(formData.get("externalSystem") ?? "").trim();
  const billingModel =
    String(formData.get("billingModel")) === "SUBSCRIPTION" ? "SUBSCRIPTION" : "COMMISSION";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!clubName || !city) return { error: "Udfyld klubbens navn og by." };
  if (!(courtCount >= 1 && courtCount <= 40)) {
    return { error: "Antal baner skal være mellem 1 og 40." };
  }
  if (!(priceHour >= 0)) return { error: "Angiv en pris på 0 kr eller derover." };
  if (!name || !email.includes("@")) {
    return { error: "Udfyld dit navn og en gyldig e-mail." };
  }
  if (password.length < 8) {
    return { error: "Adgangskoden skal være mindst 8 tegn." };
  }
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "Der findes allerede en konto med den e-mail." };
  }

  // Sikr et unikt slug
  const base = slugify(clubName) || "klub";
  let slug = base;
  for (let i = 2; await db.club.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  // Slå adressen op, så klubben kan vises på kortet. Lykkes det ikke,
  // oprettes klubben alligevel — den mangler bare på kortet indtil videre.
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
      // Nye klubber starter altid manuelt: det virker uanset hvilket system
      // de kører, og kræver ingen teknisk opsætning fra deres side.
      integrationType: "MANUAL",
      externalSystem: externalSystem || null,
      billingModel,
      courts: {
        create: Array.from({ length: courtCount }, (_, i) => ({
          name: `Bane ${i + 1}`,
          surface: "GRUS",
        })),
      },
    },
  });

  const admin = await db.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "CLUB_ADMIN",
      clubId: club.id,
      area: city,
    },
  });

  await createSession(admin.id);
  redirect("/admin");
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
        `${process.env.APP_URL ?? "https://tennis-makker.onrender.com"}/admin`,
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

  const bookingId = String(formData.get("bookingId"));
  const previous = await db.booking.findFirst({
    where: { id: bookingId, userId: user.id },
    include: { court: true },
  });
  if (!previous?.courtId) redirect("/book");

  // Find den næste forekomst af samme ugedag og tid, som ligger i fremtiden
  let startsAt = new Date(previous.startsAt);
  while (startsAt <= new Date()) {
    startsAt = addDays(startsAt, 7);
  }
  const endsAt = addHours(startsAt, 1);

  await releaseExpiredHolds();
  await refreshBeforeBooking(previous.court!.clubId);

  const { slots, needsClubEntry } = await getClubAvailability(
    previous.court!.clubId,
    startsAt,
    endsAt
  );
  const slot = slots.find(
    (s) => s.courtId === previous.courtId && s.startsAt.getTime() === startsAt.getTime()
  );

  // Er tiden taget, sendes man til klubbens side på den dag i stedet for
  // at få en fejl. Man skal videre, ikke stoppes.
  if (!slot) {
    const club = await db.club.findUnique({ where: { id: previous.court!.clubId } });
    const days = Math.round((startsAt.getTime() - Date.now()) / 86400000);
    redirect(`/klub/${club?.slug}?dag=${Math.min(6, Math.max(0, days))}&optaget=1`);
  }

  const booking = await db.booking.create({
    data: {
      kind: "COURT",
      status: "HOLD",
      startsAt,
      endsAt,
      priceKr: slot.priceKr,
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      userId: user.id,
      courtId: previous.courtId,
      needsClubEntry,
    },
  });

  redirect(await startCheckout(booking.id));
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
