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
async function openingHourSlots(
  clubId: string,
  from: Date,
  until: Date,
  isMember = false
) {
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
          priceKr:
            isMember && club.memberPriceHour != null
              ? club.memberPriceHour
              : club.priceHour,
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
// NATIVE — RacketBuddy ER bookingsystemet (fallback for klubber uden system)
// ---------------------------------------------------------------------------
export const nativeAdapter: BookingSystemAdapter = {
  type: "NATIVE",
  label: "RacketBuddy",
  async getAvailability({ clubId, from, until, isMember }: AdapterInput): Promise<AvailabilityResult> {
    const base = await openingHourSlots(clubId, from, until, isMember);
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
  label: "Frigivne gæstetider",
  async getAvailability({ clubId, from, until }: AdapterInput): Promise<AvailabilityResult> {
    const now = new Date();
    const start = now > from ? now : from;

    const club = await db.club.findUnique({
      where: { id: clubId },
      include: { courts: { orderBy: { name: "asc" } }, rules: { where: { active: true } } },
    });
    if (!club) return { slots: [], needsClubEntry: true };

    const slots: AvailableSlot[] = [];
    const seen = new Set<string>();
    const add = (s: AvailableSlot) => {
      const key = `${s.courtId}_${s.startsAt.getTime()}`;
      if (seen.has(key)) return;
      seen.add(key);
      slots.push(s);
    };

    // 1. Tider klubben har frigivet enkeltvis
    const released = await db.guestSlot.findMany({
      where: { court: { clubId }, startsAt: { gte: start, lte: until } },
      include: { court: true },
    });
    for (const r of released) {
      add({
        courtId: r.courtId,
        courtName: r.court.name,
        surface: r.court.surface,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        priceKr: r.priceKr,
      });
    }

    // 2. Tider der følger af klubbens regler
    for (const rule of club.rules) {
      const days = rule.daysOfWeek
        .split(",")
        .map((d) => Number(d.trim()))
        .filter((d) => d >= 0 && d <= 6);
      const courtIds = rule.courtIds
        ? rule.courtIds.split(",").map((c) => c.trim()).filter(Boolean)
        : club.courts.map((c: any) => c.id);

      for (let day = new Date(start); day <= until; day = addDays(day, 1)) {
        if (!days.includes(day.getDay())) continue;
        for (let h = rule.fromHour; h < rule.toHour; h++) {
          const startsAt = hourDate(day, h);
          if (startsAt < now || startsAt > until) continue;
          for (const id of courtIds) {
            const court = club.courts.find((c: any) => c.id === id);
            if (!court) continue;
            add({
              courtId: court.id,
              courtName: court.name,
              surface: court.surface,
              startsAt,
              endsAt: addHours(startsAt, 1),
              priceKr: rule.priceKr,
            });
          }
        }
      }
    }

    // 3. Sidste-øjebliks-frigivelse: en tom bane om en time er tabt indtægt
    if (club.lastMinuteHours > 0) {
      const cutoff = addHours(now, club.lastMinuteHours);
      for (let day = new Date(start); day <= until; day = addDays(day, 1)) {
        for (let h = club.openHour; h < club.closeHour; h++) {
          const startsAt = hourDate(day, h);
          if (startsAt < now || startsAt > cutoff || startsAt > until) continue;
          for (const court of club.courts) {
            add({
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
    }

    // Træk vores egne bookinger fra
    const taken = await ownBookingKeys(
      club.courts.map((c: any) => c.id),
      from,
      until
    );

    return {
      slots: slots
        .filter((s) => !taken.has(`${s.courtId}_${s.startsAt.getTime()}`))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
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
