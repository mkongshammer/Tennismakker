// Hjælpere til at generere bookbare timeslots.
import {phrase} from "./phrases";
import type {Locale} from "./sports";
import { addDays, addMinutes, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { addCalendarDays, dayKey, wallTime } from "./international";

export type WeeklySlot = { day: number; from: number; to: number }; // day: 0=søn ... 6=lør

export function hourDate(base: Date, hour: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(base, hour), 0), 0), 0);
}

/** Et tidspunkt på dagen, angivet i minutter siden midnat. */
export function minuteDate(base: Date, minutesFromMidnight: number): Date {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h), m), 0), 0);
}

/**
 * Starttidspunkterne for lektioner inden for ét interval, i minutter siden
 * midnat. Lektionerne lægges efter hinanden fra intervallets begyndelse, og
 * den sidste skal kunne nå at slutte inden for intervallet: en lektion på 45
 * minutter kl. 19.45 findes ikke, hvis træneren holder op kl. 20.
 */
export function lessonStarts(fromHour: number, toHour: number, lessonMinutes: number): number[] {
  const length = Math.max(5, Math.round(lessonMinutes));
  const starts: number[] = [];
  for (let m = fromHour * 60; m + length <= toHour * 60; m += length) starts.push(m);
  return starts;
}

/** Genererer konkrete start-tidspunkter de næste `days` dage ud fra et ugentligt mønster. */
export function upcomingSlotsFromWeekly(
  pattern: WeeklySlot[],
  days = 7,
  lessonMinutes = 60,
  timeZone?: string
): Date[] {
  const now = new Date();
  const slots: Date[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(now, d);
    const localKey = timeZone ? addCalendarDays(dayKey(now,timeZone),d) : null;
    for (const p of pattern) {
      if ((localKey ? new Date(`${localKey}T12:00:00Z`).getUTCDay() : day.getDay()) !== p.day) continue;
      for (const m of lessonStarts(p.from, p.to, lessonMinutes)) {
        const start = localKey ? wallTime(localKey,Math.floor(m/60),m%60,timeZone) : minuteDate(day, m);
        if (start && start > now) slots.push(start);
      }
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export function parseWeeklySlots(json: string): WeeklySlot[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ugentligt mønster: mellem gemt format og noget, et menneske kan klikke i
// ---------------------------------------------------------------------------
//
// Formatet i databasen er uændret — [{ day, from, to }] — så både mobilappen
// og trænersiderne læser præcis som før. Kalenderen arbejder derimod i enkelte
// timer, fordi det er dét, man peger på. Funktionerne her er broen, og de er
// rene, så de kan bruges både på serveren og i browseren.

export const DAY_NAMES = [
  "Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag",
];

/** Mandag først — sådan læser man en uge på dansk. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Renser et mønster, uanset hvor det kommer fra: frasorterer ugyldige dage og
 * timer, klipper overlap væk og slår sammenhængende timer sammen igen.
 * Kaldes både af kalenderen og af serveren — en API-klient skal ikke kunne
 * gemme noget, brugerfladen ikke selv kunne have lavet.
 */
export function normaliseWeeklySlots(input: unknown): WeeklySlot[] {
  if (!Array.isArray(input)) return [];

  const hours = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const day = Number((raw as any).day);
    const from = Number((raw as any).from);
    const to = Number((raw as any).to);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    for (let h = Math.max(0, from); h < Math.min(24, to); h++) hours.add(`${day}-${h}`);
  }

  return hoursToSlots(hours);
}

/** Timerne i et mønster som "dag-time"-nøgler, klar til at klikke i. */
export function slotsToHours(pattern: WeeklySlot[]): Set<string> {
  const hours = new Set<string>();
  for (const p of pattern) {
    for (let h = p.from; h < p.to; h++) hours.add(`${p.day}-${h}`);
  }
  return hours;
}

/** Den anden vej: enkelttimer samlet til sammenhængende intervaller. */
export function hoursToSlots(hours: Set<string>): WeeklySlot[] {
  const byDay = new Map<number, number[]>();
  for (const key of Array.from(hours)) {
    const [d, h] = key.split("-").map(Number);
    if (!Number.isInteger(d) || !Number.isInteger(h)) continue;
    byDay.set(d, [...(byDay.get(d) ?? []), h]);
  }

  const out: WeeklySlot[] = [];
  for (const day of WEEK_ORDER) {
    const list = (byDay.get(day) ?? []).sort((a, b) => a - b);
    let i = 0;
    while (i < list.length) {
      const from = list[i];
      let to = from + 1;
      while (i + 1 < list.length && list[i + 1] === to) {
        to++;
        i++;
      }
      out.push({ day, from, to });
      i++;
    }
  }
  return out;
}

/** "Tirsdag 16–20 · Lørdag 9–13" — mønsteret sagt højt. */
export function describeWeeklySlots(pattern: WeeklySlot[], locale: Locale = "da"): string {
  if (pattern.length === 0) return "";
  return pattern
    .map((p) => `${phrase(DAY_NAMES[p.day],locale)} ${p.from}–${p.to}`)
    .join(" · ");
}

/** Timer om ugen i alt — den ene tal, en træner selv regner efter. */
export function weeklyHours(pattern: WeeklySlot[]): number {
  return pattern.reduce((sum, p) => sum + (p.to - p.from), 0);
}

/** Hvor mange lektioner et helt ugemønster giver plads til. */
export function lessonCount(pattern: WeeklySlot[], lessonMinutes: number): number {
  return pattern.reduce((n, p) => n + lessonStarts(p.from, p.to, lessonMinutes).length, 0);
}

/** "45 min" — længden sagt kort. Hele timer skrives som timer. */
export function describeLength(lessonMinutes: number, locale: Locale = "da"): string {
  if (lessonMinutes % 60 === 0) {
    const hours = lessonMinutes / 60;
    return phrase(hours === 1 ? "1 time" : "{count} timer", locale, {count:hours});
  }
  return `${lessonMinutes} min`;
}

// ---------------------------------------------------------------------------
// Lektionens længde og pris
// ---------------------------------------------------------------------------
//
// Rene funktioner, og det er med vilje: både trænerens redigeringsside i
// browseren og serveren regner på dem, og de skal give samme svar begge
// steder. Ligger de sammen med databasekaldene, kan browseren ikke få dem.

/** De længder, en træner kan vælge imellem. */
export const LESSON_LENGTHS = [30, 45, 60, 90] as const;

/**
 * Prisen for én lektion.
 *
 * Timeprisen bliver stående som det, trænere sammenlignes på — ellers kunne
 * en halv time til 200 kr se billigere ud end en hel til 350.
 */
export function lessonPriceKr(priceHour: number, lessonMinutes: number): number {
  return Math.max(1, Math.round((priceHour * lessonMinutes) / 60));
}

/** Hvornår en lektion, der begynder her, er slut. */
export function lessonEnd(startsAt: Date, lessonMinutes: number): Date {
  return addMinutes(startsAt, lessonMinutes);
}

/** Kun én af de gyldige længder slipper igennem — også fra en API-klient. */
export function normaliseLessonMinutes(input: unknown): number {
  const n = Number(input);
  return (LESSON_LENGTHS as readonly number[]).includes(n) ? n : 60;
}
