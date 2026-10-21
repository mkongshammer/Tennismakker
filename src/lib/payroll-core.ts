// Hours into pay. Pure functions: a list of time entries becomes regular
// and overtime minutes per person per workweek, then gross pay.
//
// Overtime follows the US rule: hours over the weekly threshold (40 by
// default) are paid at 1.5x. The workweek runs Monday to Sunday in the
// club's time zone. Break minutes are unpaid and come off first.

export type EntryLike = { staffId: string; clockIn: Date; clockOut: Date | null; breakMinutes: number };
export type StaffLike = { id: string; name: string; hourlyRateCents: number; overtimeAfterHours: number };
export type PayLine = { staffId: string; name: string; regularMinutes: number; overtimeMinutes: number; rateCents: number; grossCents: number; entries: number };

export const OVERTIME_MULTIPLIER = 1.5;

export const workedMinutes = (e: EntryLike, now = new Date()) => Math.max(0, Math.round(((e.clockOut ?? now).getTime() - e.clockIn.getTime()) / 60_000) - (e.breakMinutes || 0));

/** Monday of the workweek containing `d`, as a YYYY-MM-DD key in the club's time zone. */
export function weekKey(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const day = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  day.setUTCDate(day.getUTCDate() - (dow < 0 ? 0 : dow));
  return day.toISOString().slice(0, 10);
}

/** Split one person's closed entries into regular and overtime minutes, week by week. */
export function splitOvertime(entries: EntryLike[], overtimeAfterHours: number, timeZone: string) {
  const byWeek = new Map<string, number>();
  for (const e of entries) { if (!e.clockOut) continue; const k = weekKey(e.clockIn, timeZone); byWeek.set(k, (byWeek.get(k) ?? 0) + workedMinutes(e)); }
  let regular = 0, overtime = 0;
  const threshold = overtimeAfterHours > 0 ? overtimeAfterHours * 60 : Infinity;
  for (const minutes of byWeek.values()) { const ot = Math.max(0, minutes - threshold); overtime += ot; regular += minutes - ot; }
  return { regularMinutes: regular, overtimeMinutes: overtime };
}

export const grossCents = (regularMinutes: number, overtimeMinutes: number, rateCents: number) => Math.round((regularMinutes * rateCents + overtimeMinutes * rateCents * OVERTIME_MULTIPLIER) / 60);

/** The payroll table for a period. People with no closed time in the period are left out. */
export function payrollLines(staff: StaffLike[], entries: EntryLike[], timeZone: string): PayLine[] {
  const out: PayLine[] = [];
  for (const s of staff) {
    const mine = entries.filter((e) => e.staffId === s.id && e.clockOut);
    if (!mine.length) continue;
    const { regularMinutes, overtimeMinutes } = splitOvertime(mine, s.overtimeAfterHours, timeZone);
    out.push({ staffId: s.id, name: s.name, regularMinutes, overtimeMinutes, rateCents: s.hourlyRateCents, grossCents: grossCents(regularMinutes, overtimeMinutes, s.hourlyRateCents), entries: mine.length });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Generic payroll import file (Gusto, QuickBooks Payroll, ADP all take hours by employee). */
export function payrollCsv(lines: PayLine[], periodStart: string, periodEnd: string, currency: string) {
  const head = ["Employee", "Period start", "Period end", "Regular hours", "Overtime hours", "Hourly rate", "Gross pay", "Currency"];
  const rows = lines.map((l) => [l.name, periodStart, periodEnd, (l.regularMinutes / 60).toFixed(2), (l.overtimeMinutes / 60).toFixed(2), (l.rateCents / 100).toFixed(2), (l.grossCents / 100).toFixed(2), currency]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Every entry as a line, for the timesheet. */
export function timesheetCsv(entries: (EntryLike & { name: string; note: string | null; source: string })[], timeZone: string) {
  const f = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) : "");
  const head = ["Employee", "Clock in", "Clock out", "Break (min)", "Hours", "Source", "Note"];
  const rows = entries.map((e) => [e.name, f(e.clockIn), f(e.clockOut), e.breakMinutes, e.clockOut ? (workedMinutes(e) / 60).toFixed(2) : "", e.source, e.note ?? ""]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin);
