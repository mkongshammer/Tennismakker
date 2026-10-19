// Pure layout for the club's court schedule: which bookings touch which
// hour cell on a given venue-local day.
//
// Everything is computed on the venue's wall clock, so a day with a DST
// change still shows the hours a manager sees on the wall. Bookings may
// start or end on the half hour, span several hours, begin before opening
// or run past closing, or start yesterday and run into today — each case
// is covered in schedule-grid.test.ts.
import { wallParts, dayKey, addCalendarDays } from "./international";

export interface GridBooking {
  id: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface GridPlacement<T extends GridBooking> {
  booking: T;
  /** Minutes from venue-local midnight, clamped to the day. */
  startMin: number;
  endMin: number;
  /** True in the first hour cell the booking occupies. */
  startsInThisHour: boolean;
  /** True when the booking does not fill this whole hour cell. */
  partial: boolean;
}

export interface DayGrid<T extends GridBooking> {
  /** Hours shown as rows: opening hours, extended to cover any booking outside them. */
  hours: number[];
  /** Hours outside opening hours that only appear because something is booked there. */
  extraHours: number[];
  cells: Map<string, GridPlacement<T>[]>;
}

export const cellKey = (courtId: string, hour: number) => `${courtId}:${hour}`;

/** Venue-local minutes since midnight of `key` for an instant, clamped to [0, 1440]. */
export function minutesIntoDay(instant: Date, key: string, timeZone: string): number {
  const day = dayKey(instant, timeZone);
  if (day < key) return 0;
  if (day > key) return 24 * 60;
  const p = wallParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

export function layoutDay<T extends GridBooking>(input: {
  bookings: T[];
  key: string;
  timeZone: string;
  openHour: number;
  closeHour: number;
}): DayGrid<T> {
  const { bookings, key, timeZone } = input;
  const cells = new Map<string, GridPlacement<T>[]>();
  let minHour = Math.max(0, Math.floor(input.openHour));
  let maxHour = Math.min(24, Math.ceil(input.closeHour));
  const baseHours = new Set<number>();
  for (let h = minHour; h < maxHour; h++) baseHours.add(h);

  for (const b of bookings) {
    const startMin = minutesIntoDay(b.startsAt, key, timeZone);
    const endMin = minutesIntoDay(b.endsAt, key, timeZone);
    if (endMin <= startMin) continue; // not on this day at all
    const firstHour = Math.floor(startMin / 60);
    const lastHour = Math.ceil(endMin / 60) - 1;
    for (let h = firstHour; h <= lastHour; h++) {
      const cellStart = h * 60;
      const cellEnd = cellStart + 60;
      const partial = startMin > cellStart || endMin < cellEnd;
      const k = cellKey(b.courtId, h);
      const list = cells.get(k) ?? [];
      list.push({ booking: b, startMin, endMin, startsInThisHour: h === firstHour, partial });
      cells.set(k, list);
      if (h < minHour) minHour = h;
      if (h + 1 > maxHour) maxHour = h + 1;
    }
  }
  for (const list of cells.values()) list.sort((a, b) => a.startMin - b.startMin);

  const hours: number[] = [];
  const extraHours: number[] = [];
  for (let h = minHour; h < maxHour; h++) {
    hours.push(h);
    if (!baseHours.has(h)) extraHours.push(h);
  }
  return { hours, extraHours, cells };
}

/** The window to query: bookings overlapping the venue-local day. */
export function dayBounds(key: string, timeZone: string, wallTime: (key: string, h: number, m: number, tz: string) => Date | null) {
  const start = wallTime(key, 0, 0, timeZone) ?? wallTime(key, 1, 0, timeZone)!;
  const next = addCalendarDays(key, 1);
  const end = wallTime(next, 0, 0, timeZone) ?? wallTime(next, 1, 0, timeZone)!;
  return { start, end };
}

/** "2:30 PM" style label for a minute-of-day in en-US, "14:30" elsewhere. */
export function minuteLabel(min: number, locale: string): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  if (locale === "en-US") {
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const suffix = h < 12 ? "AM" : "PM";
    return m ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
