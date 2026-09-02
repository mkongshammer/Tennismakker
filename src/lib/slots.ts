// Hjælpere til at generere bookbare timeslots.
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

export type WeeklySlot = { day: number; from: number; to: number }; // day: 0=søn ... 6=lør

export function hourDate(base: Date, hour: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(base, hour), 0), 0), 0);
}

/** Genererer konkrete start-tidspunkter de næste `days` dage ud fra et ugentligt mønster. */
export function upcomingSlotsFromWeekly(pattern: WeeklySlot[], days = 7): Date[] {
  const now = new Date();
  const slots: Date[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(now, d);
    for (const p of pattern) {
      if (day.getDay() !== p.day) continue;
      for (let h = p.from; h < p.to; h++) {
        const start = hourDate(day, h);
        if (start > now) slots.push(start);
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
export function describeWeeklySlots(pattern: WeeklySlot[]): string {
  if (pattern.length === 0) return "";
  return pattern
    .map((p) => `${DAY_NAMES[p.day]} ${p.from}–${p.to}`)
    .join(" · ");
}

/** Timer om ugen i alt — den ene tal, en træner selv regner efter. */
export function weeklyHours(pattern: WeeklySlot[]): number {
  return pattern.reduce((sum, p) => sum + (p.to - p.from), 0);
}
