// Staff, the time clock and payroll runs, in the database.
import { db } from "./db";
import { payrollLines, type PayLine } from "./payroll-core";

/** Clock in or out by PIN on the club's desk tablet. One open entry per person. */
export async function punchByPin(clubId: string, pin: string, note?: string | null) {
  const staff = await db.staffMember.findUnique({ where: { clubId_pin: { clubId, pin } } });
  if (!staff || !staff.active) return { ok: false as const, error: "That PIN doesn't match anyone on staff." };
  const open = await db.timeEntry.findFirst({ where: { staffId: staff.id, clockOut: null }, orderBy: { clockIn: "desc" } });
  if (open) {
    // A forgotten clock-out shouldn't bill a 30-hour day: close at 16 hours and let the admin fix it.
    const now = new Date();
    const maxOut = new Date(open.clockIn.getTime() + 16 * 3_600_000);
    const capped = now > maxOut;
    const clockOut = capped ? maxOut : now;
    await db.timeEntry.update({ where: { id: open.id }, data: { clockOut, note: [open.note, note].filter(Boolean).join(" · ") || null } });
    return { ok: true as const, direction: "out" as const, name: staff.name, since: open.clockIn, at: clockOut, capped };
  }
  const entry = await db.timeEntry.create({ data: { clubId, staffId: staff.id, clockIn: new Date(), source: "CLOCK", note: note?.slice(0, 200) || null } });
  return { ok: true as const, direction: "in" as const, name: staff.name, at: entry.clockIn, since: null, capped: false };
}

/** Who is clocked in right now. */
export async function onTheClock(clubId: string) {
  return db.timeEntry.findMany({ where: { clubId, clockOut: null }, include: { staff: { select: { name: true, role: true } } }, orderBy: { clockIn: "asc" } });
}

export async function timeEntriesBetween(clubId: string, from: Date, to: Date) {
  return db.timeEntry.findMany({ where: { clubId, clockIn: { gte: from, lt: to } }, include: { staff: { select: { id: true, name: true, hourlyRateCents: true, overtimeAfterHours: true } } }, orderBy: { clockIn: "asc" } });
}

/** Preview of a pay period: lines per person from closed, not-yet-paid entries. */
export async function payrollPreview(clubId: string, from: Date, to: Date, timeZone: string): Promise<{ lines: PayLine[]; unpaidOpen: number }> {
  const [staff, entries, unpaidOpen] = await Promise.all([
    db.staffMember.findMany({ where: { clubId }, select: { id: true, name: true, hourlyRateCents: true, overtimeAfterHours: true } }),
    db.timeEntry.findMany({ where: { clubId, clockIn: { gte: from, lt: to }, clockOut: { not: null }, payrollRunId: null } }),
    db.timeEntry.count({ where: { clubId, clockIn: { gte: from, lt: to }, clockOut: null } }),
  ]);
  return { lines: payrollLines(staff, entries, timeZone), unpaidOpen };
}

/** Close the period: the entries it covers are stamped with the run and can't be paid twice. */
export async function closePayroll(clubId: string, from: Date, to: Date, timeZone: string, currency: string) {
  const { lines, unpaidOpen } = await payrollPreview(clubId, from, to, timeZone);
  if (unpaidOpen) return { ok: false as const, error: "Someone is still clocked in within this period. Clock them out or fix the entry first." };
  if (!lines.length) return { ok: false as const, error: "There are no hours to pay in this period." };
  const run = await db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({ data: { clubId, periodStart: from, periodEnd: to, lines: JSON.stringify(lines), totalCents: lines.reduce((s, l) => s + l.grossCents, 0), currency } });
    await tx.timeEntry.updateMany({ where: { clubId, clockIn: { gte: from, lt: to }, clockOut: { not: null }, payrollRunId: null }, data: { payrollRunId: run.id } });
    return run;
  });
  return { ok: true as const, run };
}

export async function reopenPayroll(clubId: string, runId: string) {
  const run = await db.payrollRun.findFirst({ where: { id: runId, clubId }, select: { id: true } });
  if (!run) return;
  await db.$transaction([db.timeEntry.updateMany({ where: { payrollRunId: runId }, data: { payrollRunId: null } }), db.payrollRun.delete({ where: { id: runId } })]);
}
