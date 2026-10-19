// The club's day at a glance: courts across, hours down, every booking in
// its cell. Read it like a whiteboard behind the front desk.
import Link from "next/link";
import { db } from "../../lib/db";
import { dayKey, wallTime, addCalendarDays, wallParts, formatDate, formatMoney } from "../../lib/international";
import { adminCancelBooking } from "../../lib/club-schedule-actions";
import { Icon } from "../../components/ui";

type Court = { id: string; name: string; sport: string; indoor: boolean };

export async function CourtSchedule({ clubId, courts, openHour, closeHour, timeZone, currency, locale, dayOffset, baseHref }: { clubId: string; courts: Court[]; openHour: number; closeHour: number; timeZone: string; currency: string; locale: string; dayOffset: number; baseHref: string }) {
  const today = dayKey(new Date(), timeZone);
  const key = addCalendarDays(today, dayOffset);
  const start = wallTime(key, 0, 0, timeZone)!;
  const end = wallTime(addCalendarDays(key, 1), 0, 0, timeZone)!;
  const courtIds = courts.map((c) => c.id);
  const [bookings, released, blocks] = await Promise.all([
    db.booking.findMany({ where: { courtId: { in: courtIds }, status: { in: ["HOLD", "CONFIRMED"] }, startsAt: { gte: start, lt: end } }, include: { user: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
    db.guestSlot.findMany({ where: { courtId: { in: courtIds }, startsAt: { gte: start, lt: end } }, select: { courtId: true, startsAt: true } }),
    db.systemBlock.findMany({ where: { clubId, startsAt: { gte: start, lt: end } }, select: { courtId: true, startsAt: true, status: true } }),
  ]);
  const cell = (courtId: string, hour: number) => `${courtId}:${hour}`;
  const byCell = new Map<string, (typeof bookings)[number]>();
  for (const b of bookings) {
    const from = wallParts(b.startsAt, timeZone).hour;
    const hours = Math.max(1, Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 3600000));
    for (let h = from; h < from + hours; h++) byCell.set(cell(b.courtId!, h), b);
  }
  const releasedSet = new Set(released.map((r) => cell(r.courtId, wallParts(r.startsAt, timeZone).hour)));
  const blockedSet = new Set(blocks.filter((b) => b.status !== "FAILED").map((b) => cell(b.courtId, wallParts(b.startsAt, timeZone).hour)));
  const hours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i);
  const hourLabel = (h: number) => (locale === "en-US" ? `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}` : `${String(h).padStart(2, "0")}:00`);
  const nowParts = wallParts(new Date(), timeZone);
  const isToday = dayOffset === 0;
  const booked = bookings.filter((b) => b.status === "CONFIRMED").length;
  const capacity = hours.length * courts.length;

  return (
    <section className="card-flat min-w-0" aria-labelledby="schedule-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="schedule-title" className="display text-title">Court schedule</h3>
          <p className="mt-1 text-sm text-slate">{booked} of {capacity} court-hours booked · {formatDate(start, locale, timeZone, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
          <div className="flex w-max gap-1.5">
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
              {hours.map((h) => {
                const past = isToday && h < nowParts.hour;
                return (
                  <tr key={h}>
                    <th scope="row" className="data pr-2 text-left text-xs font-bold text-slate">{hourLabel(h)}{past && <span className="sr-only"> (past)</span>}</th>
                    {courts.map((c) => {
                      const b = byCell.get(cell(c.id, h));
                      const startsHere = b && wallParts(b.startsAt, timeZone).hour === h;
                      if (b) {
                        return (
                          <td key={c.id} className="px-1">
                            <div className={`rounded-lg px-2 py-1.5 ${b.status === "HOLD" ? "border border-dashed border-warning/60 bg-warning-soft text-warning-ink" : "bg-court text-chalk"}`}>
                              {startsHere ? (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate font-semibold">{b.user.name}</span>
                                  <span className="data shrink-0 text-xs opacity-80">{formatMoney(b.priceKr, currency, locale)}</span>
                                </div>
                              ) : (
                                <span className="text-xs opacity-70">cont.</span>
                              )}
                              {startsHere && (
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-85">
                                  <span>{b.status === "HOLD" ? "Awaiting payment" : b.needsClubEntry && !b.clubEnteredAt ? "Enter in your system" : "Paid"}</span>
                                  {!past && (
                                    <form action={adminCancelBooking}>
                                      <input type="hidden" name="id" value={b.id} />
                                      <button className="rounded-md px-1.5 py-0.5 hover:bg-white/15" title="Cancel this booking (refund rules apply)"><Icon name="x" size={12} /></button>
                                    </form>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }
                      const released = releasedSet.has(cell(c.id, h));
                      const blocked = blockedSet.has(cell(c.id, h));
                      return (
                        <td key={c.id} className="px-1">
                          <div className={`rounded-lg px-2 py-1.5 text-xs ${past ? "text-slate-light" : released ? "border border-success/30 bg-success-soft text-success-ink" : blocked ? "border border-slate/20 bg-mist text-slate" : "border border-dashed border-slate/20 text-slate"}`}>
                            {past ? "—" : released ? "Released to guests" : blocked ? "Blocked in your system" : "Open"}
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
      <p className="mt-3 text-xs text-slate">Blue is paid. Dashed amber is a hold awaiting payment (released automatically after 10 minutes). Cancelling from here refunds the player when the start is more than 24 hours away.</p>
    </section>
  );
}
