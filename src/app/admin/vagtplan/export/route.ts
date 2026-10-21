// Payroll and timesheet downloads. ?run=<id> gives a closed run as the
// payroll import file; ?from&to&format=timesheet gives every entry.
import { getCurrentUser } from "../../../../lib/session";
import { db } from "../../../../lib/db";
import { payrollCsv, timesheetCsv, type PayLine } from "../../../../lib/payroll-core";
import { payrollPreview, timeEntriesBetween } from "../../../../lib/payroll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLUB_ADMIN" || !user.clubId) return new Response("Forbidden", { status: 403 });
  const club = await db.club.findUnique({ where: { id: user.clubId }, select: { timeZone: true, slug: true, currency: true } });
  if (!club) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const csv = (body: string, name: string) => new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: club.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const runId = url.searchParams.get("run");
  if (runId) {
    const run = await db.payrollRun.findFirst({ where: { id: runId, clubId: user.clubId } });
    if (!run) return new Response("Not found", { status: 404 });
    const end = new Date(run.periodEnd.getTime() - 1);
    return csv(payrollCsv(JSON.parse(run.lines) as PayLine[], day(run.periodStart), day(end), run.currency), `${club.slug}-payroll-${day(run.periodStart)}-${day(end)}.csv`);
  }
  // Dates are club-local days; the range runs from the start of `from` to the end of `to`.
  const { wallTime } = await import("../../../../lib/international");
  const fromKey = url.searchParams.get("from") ?? "", toKey = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) return new Response("Bad range", { status: 400 });
  const from = wallTime(fromKey, 0, 0, club.timeZone)!, to = new Date(wallTime(toKey, 0, 0, club.timeZone)!.getTime() + 86_400_000);
  if (to <= from || to.getTime() - from.getTime() > 400 * 86_400_000) return new Response("Bad range", { status: 400 });
  if (url.searchParams.get("format") === "timesheet") {
    const entries = await timeEntriesBetween(user.clubId, from, to);
    return csv(timesheetCsv(entries.map((e) => ({ ...e, name: e.staff.name })), club.timeZone), `${club.slug}-timesheet-${day(from)}-${day(new Date(to.getTime() - 1))}.csv`);
  }
  const { lines } = await payrollPreview(user.clubId, from, to, club.timeZone);
  return csv(payrollCsv(lines, day(from), day(new Date(to.getTime() - 1)), club.currency), `${club.slug}-payroll-preview-${day(from)}.csv`);
}
