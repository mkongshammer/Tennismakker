import { addDays, addHours } from "date-fns";
import { db } from "../db";
import { hourDate } from "../slots";
import type {
  AdapterInput,
  AvailabilityResult,
  AvailableSlot,
  BookingSystemAdapter,
} from "./types";

/** Timeslots i klubbens åbningstid mellem from og until. */
async function openingHourSlots(clubId: string, from: Date, until: Date) {
  const club = await db.club.findUnique({
    where: { id: clubId },
    include: { courts: { orderBy: { name: "asc" } } },
  });
  if (!club) return null;

  const now = new Date();
  const slots: AvailableSlot[] = [];
  for (let day = new Date(from); day <= until; day = addDays(day, 1)) {
    for (let h = club.openHour; h < club.closeHour; h++) {
      const startsAt = hourDate(day, h);
      if (startsAt < now || startsAt > until) continue;
      for (const court of club.courts) {
        slots.push({
          courtId: court.id,
          courtName: court.name,
          surface: court.surface,
          startsAt,
          endsAt: addHours(startsAt, 1),
          priceKr: club.priceHour,
        });
      }
    }
  }
  return { club, slots };
}

/** Vores egne aktive bookinger i perioden, som nøgler "courtId_timestamp". */
async function ownBookingKeys(courtIds: string[], from: Date, until: Date) {
  const bookings = await db.booking.findMany({
    where: {
      courtId: { in: courtIds },
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: from, lte: until },
    },
    select: { courtId: true, startsAt: true },
  });
  return new Set(bookings.map((b: any) => `${b.courtId}_${b.startsAt.getTime()}`));
}

// ---------------------------------------------------------------------------
// NATIVE — Tennis Makker ER bookingsystemet (fallback for klubber uden system)
// ---------------------------------------------------------------------------
export const nativeAdapter: BookingSystemAdapter = {
  type: "NATIVE",
  label: "Tennis Makker",
  async getAvailability({ clubId, from, until }: AdapterInput): Promise<AvailabilityResult> {
    const base = await openingHourSlots(clubId, from, until);
    if (!base) return { slots: [], needsClubEntry: false };

    const taken = await ownBookingKeys(
      base.club.courts.map((c: any) => c.id),
      from,
      until
    );
    return {
      slots: base.slots.filter((s) => !taken.has(`${s.courtId}_${s.startsAt.getTime()}`)),
      needsClubEntry: false,
    };
  },
};

// ---------------------------------------------------------------------------
// MANUAL — klubben frigiver selv enkelte gæstetider
// ---------------------------------------------------------------------------
export const manualAdapter: BookingSystemAdapter = {
  type: "MANUAL",
  label: "Manuelt frigivne gæstetider",
  async getAvailability({ clubId, from, until }: AdapterInput): Promise<AvailabilityResult> {
    const now = new Date();
    const released = await db.guestSlot.findMany({
      where: {
        court: { clubId },
        startsAt: { gte: now > from ? now : from, lte: until },
      },
      include: { court: true },
      orderBy: { startsAt: "asc" },
    });

    const taken = await ownBookingKeys(
      released.map((r: any) => r.courtId),
      from,
      until
    );

    const slots: AvailableSlot[] = released
      .filter((r: any) => !taken.has(`${r.courtId}_${r.startsAt.getTime()}`))
      .map((r: any) => ({
        courtId: r.courtId,
        courtName: r.court.name,
        surface: r.court.surface,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        priceKr: r.priceKr,
      }));

    return {
      slots,
      needsClubEntry: true,
      note: "Bookinger skal føres ind i klubbens eget system.",
    };
  },
};

// ---------------------------------------------------------------------------
// ICAL — spejl af klubbens eget system via kalenderfeed
// ---------------------------------------------------------------------------
export const icalAdapter: BookingSystemAdapter = {
  type: "ICAL",
  label: "Kalenderfeed",
  async getAvailability({ clubId, from, until }: AdapterInput): Promise<AvailabilityResult> {
    const base = await openingHourSlots(clubId, from, until);
    if (!base) return { slots: [], needsClubEntry: true };

    const courtIds = base.club.courts.map((c: any) => c.id);
    const [busy, taken] = await Promise.all([
      db.externalBusy.findMany({
        where: { courtId: { in: courtIds }, endsAt: { gte: from }, startsAt: { lte: until } },
      }),
      ownBookingKeys(courtIds, from, until),
    ]);

    const isBusy = (courtId: string, start: Date, end: Date) =>
      busy.some(
        (b: any) => b.courtId === courtId && b.startsAt < end && b.endsAt > start
      );

    const slots = base.slots.filter(
      (s) =>
        !taken.has(`${s.courtId}_${s.startsAt.getTime()}`) &&
        !isBusy(s.courtId, s.startsAt, s.endsAt)
    );

    return {
      slots,
      needsClubEntry: true,
      note: base.club.lastSyncAt
        ? `Ledighed spejlet fra klubbens system. Bookinger skal føres ind i klubbens eget system.`
        : "Feed er ikke synkroniseret endnu — kør en synkronisering i admin.",
    };
  },
};

// ---------------------------------------------------------------------------
// API — direkte integration (fx Halbooking). Kræver partneraftale.
// ---------------------------------------------------------------------------
export const apiAdapter: BookingSystemAdapter = {
  type: "API",
  label: "Direkte API-integration",
  async getAvailability(): Promise<AvailabilityResult> {
    // Når en partneraftale er på plads, implementeres opslaget her.
    // Resten af platformen skal ikke ændres — kontrakten er den samme.
    return {
      slots: [],
      needsClubEntry: true,
      note: "API-integration er ikke sat op for denne klub endnu.",
    };
  },
};
