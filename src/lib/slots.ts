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
