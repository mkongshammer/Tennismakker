// The club's day at a glance: courts across, hours down, every booking in
// its cell. Read it like a whiteboard behind the front desk.
//
// Geometry comes from src/lib/schedule-grid.ts (pure, unit-tested): half-hour
// starts, 90-minute lessons, bookings outside opening hours and DST days all
// render where a manager expects them.
import Link from "next/link";
import { db } from "../../lib/db";
import { dayKey, wallTime, addCalendarDays, wallParts, formatDate, formatMoney } from "../../lib/international";
import { layoutDay, cellKey, dayBounds, minuteLabel } from "../../lib/schedule-grid";
import { CancelBookingDialog } from "./CancelBookingDialog";

type Court = { id: string; name: string; sport: string; indoor: boolean };

export async function CourtSchedule({ clubId, courts, openHour, closeHour, timeZone, currency, locale, dayOffset, baseHref }: { clubId: string; courts: Court[]; openHour: number; closeHour: number; timeZone: string; currency: string; locale: string; dayOffset: number; baseHref: string }) {
  const today = dayKey(new Date(), timeZone);
  const key = addCalendarDays(today, dayOffset);
  const { start, end } = dayBounds(key, timeZone, wallTime);
  const courtIds = courts.map((c) => c.id);
  const [bookings, released, blocks] = await Promise.all([
    // Overlap, not "starts today": a lesson that began at 11 PM yesterday still occupies this morning's first cell.
    db.booking.findMany({ where: { courtId: { in: courtIds }, status: { in: ["HOLD", "CONFIRMED"] }, startsAt: { lt: end }, endsAt: { gt: start } }, include: { user: { select: { name: true } }, payment: { select: { status: true } } }, orderBy: { startsAt: "asc" } }),
    db.guestSlot.findMany({ where: { courtId: { in: courtIds }, startsAt: { gte: start, lt: end } }, select: { courtId: true, startsAt: true } }),
    db.systemBlock.findMany({ where: { clubId, startsAt: { gte: start, lt: end } }, select: { courtId: true, startsAt: true, status: true } }),
  ]);
  const grid = layoutDay({ bookings: bookings.map((b) => ({ ...b, courtId: b.courtId! })), key, timeZone, openHour, closeHour });
  const releasedSet = new Set(released.map((r) => cellKey(r.courtId, wallParts(r.startsAt, timeZone).hour)));
  const blockedSet = new Set(blocks.filter((b) => b.status !== "FAILED").map((b) => cellKey(b.courtId, wallParts(b.startsAt, timeZone).hour)));
  const extra = new Set(grid.extraHours);
  const nowParts = wallParts(new Date(), timeZone);
  const isToday = dayOffset === 0;
  const booked = bookings.filter((b) => b.status === "CONFIRMED").length;
  const capacity = Math.max(0, closeHour - openHour) * courts.length;
  const whenLabel = (startMin: number, endMin: number) => `${minuteLabel(startMin, locale)}–${minuteLabel(endMin, locale)}`;

  return (
    <section className="card-flat min-w-0" aria-labelledby="schedule-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="schedule-title" className="display text-title">Court schedule</h3>
          <p className="mt-1 text-sm text-slate">{booked} of {capacity} court-hours booked · {formatDate(start, locale, timeZone, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
          <div className="flex w-max gap-1.5" role="tablist" aria-label="Day">
            {Array.from({ length: 7 }, (_, i) => (
              <Link key={i} href={i === 0 ? baseHref : `${baseHref}?dag=${i}`} aria-current={i === dayOffset ? "page" : undefined} className={`pill min-h-9 text-xs ${i === dayOffset ? "is-active" : ""}`}>
                {i === 0 ? "Today" : formatDate(wallTime(addCalendarDays(today, i), 12, 0, timeZone)!, locale, timeZone, { weekday: "short", day: "numeric" })}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {courts.length === 0 ? (
        <p className="mt-4 text-sm text-slate">Add courts to see the schedule.</p>
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-16 text-left text-xs font-semibold text-slate"><span className="sr-only">Hour</span></th>
                {courts.map((c) => (
                  <th key={c.id} scope="col" className="px-1 text-left text-xs font-semibold">
                    {c.name}
                    {c.indoor && <span className="ml-1 font-normal text-slate">indoor</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.hours.map((h) => {
                const past = isToday && h < nowParts.hour;
                const outside = extra.has(h);
                return (
                  <tr key={h}>
                    <th scope="row" className={`data pr-2 text-left text-xs font-bold ${outside ? "text-slate-light" : "text-slate"}`}>
                      {minuteLabel(h * 60, locale)}
                      {past && <span className="sr-only"> (past)</span>}
                      {outside && <span className="sr-only"> (outside opening hours)</span>}
                    </th>
                    {courts.map((c) => {
                      const placements = grid.cells.get(cellKey(c.id, h)) ?? [];
                      if (placements.length) {
                        return (
                          <td key={c.id} className="px-1 align-top">
                            <div className="space-y-1">
                              {placements.map(({ booking: b, startMin, endMin, startsInThisHour, partial }) => {
                                const hold = b.status === "HOLD";
                                const paid = b.payment?.status === "PAID";
                                return (
                                  <div key={b.id} className={`rounded-lg px-2 py-1.5 ${hold ? "border border-dashed border-warning/60 bg-warning-soft text-warning-ink" : "bg-court text-chalk"}`}>
                                    {startsInThisHour ? (
                                      <>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="min-w-0 truncate font-semibold">{b.user.name}</span>
                                          <span className="data shrink-0 text-xs opacity-80">{formatMoney(b.priceKr, currency, locale)}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-85">
                                          <span>
                                            {partial || endMin - startMin !== 60 ? `${whenLabel(startMin, endMin)} · ` : ""}
                                            {hold ? "Awaiting payment" : b.needsClubEntry && !b.clubEnteredAt ? "Enter in your system" : paid ? "Paid" : "Confirmed"}
                                          </span>
                                          {!past && (
                                            <CancelBookingDialog
                                              bookingId={b.id}
                                              playerName={b.user.name}
                                              when={`${formatDate(b.startsAt, locale, timeZone, { weekday: "short", month: "short", day: "numeric" })} ${whenLabel(startMin, endMin)} · ${c.name}`}
                                              amountLabel={formatMoney(b.priceKr, currency, locale)}
                                              paid={paid}
                                              dark={!hold}
                                            />
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-xs opacity-70">{partial ? `until ${minuteLabel(endMin, locale)}` : "cont."}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      }
                      const released = releasedSet.has(cellKey(c.id, h));
                      const blocked = blockedSet.has(cellKey(c.id, h));
                      return (
                        <td key={c.id} className="px-1 align-top">
                          <div className={`rounded-lg px-2 py-1.5 text-xs ${past || outside ? "text-slate-light" : released ? "border border-success/30 bg-success-soft text-success-ink" : blocked ? "border border-slate/20 bg-mist text-slate" : "border border-dashed border-slate/20 text-slate"}`}>
                            {past ? "—" : outside ? "Closed" : released ? "Released to guests" : blocked ? "Blocked in your system" : "Open"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate">Blue is paid. Dashed amber is a hold awaiting payment (released automatically after 10 minutes). When you cancel from here the player is always refunded in full — the 24-hour rule only applies when players cancel themselves.</p>
    </section>
  );
}
