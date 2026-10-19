// The club admin home. A manager should be able to glance at this and know
// what is happening today, how the week is going, and what needs doing.
import Link from "next/link";
import type { ClubDashboard } from "../../lib/club-dashboard";
import { formatDate, formatMoney } from "../../lib/international";
import { markClubEntered } from "../../lib/actions";
import { Icon, Notice, StatTile } from "../../components/ui";

function TrendBars({ days, timeZone }: { days: ClubDashboard["week"]["trend"]; timeZone: string }) {
  const max = Math.max(1, ...days.map((d) => d.bookings));
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Bookings per day, last ${days.length} days: ${days.map((d) => `${d.label} ${d.bookings}`).join(", ")}`}>
      {days.map((d, i) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.key}: ${d.bookings} bookings`}>
          <div className={`w-full rounded-md ${i >= days.length - 7 ? "bg-court" : "bg-court/30"}`} style={{ height: `${Math.max(4, (d.bookings / max) * 80)}px` }} />
          <span className="text-[10px] text-slate-light">{d.label[0]}</span>
        </div>
      ))}
      <span className="sr-only">{timeZone}</span>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-slate-light">no data last week</span>;
  const tone = value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-slate";
  return <span className={`text-xs font-semibold ${tone}`}>{value > 0 ? "▲" : value < 0 ? "▼" : "•"} {Math.abs(value)}% vs last week</span>;
}

export function ClubHome({ data, locale }: { data: ClubDashboard; locale: string }) {
  const { club, today, week, upcoming, tasks } = data;
  const money = (n: number) => formatMoney(n, club.currency, locale);
  const time = (d: Date) => formatDate(d, locale, club.timeZone, { hour: "numeric", minute: "2-digit" });
  const dayLabel = (d: Date) => formatDate(d, locale, club.timeZone, { weekday: "short", month: "short", day: "numeric" });
  const toEnter = upcoming.filter((b) => b.needsClubEntry && !b.clubEnteredAt);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-6">
      {tasks.length > 0 && (
        <section aria-labelledby="tasks-title" className="space-y-2">
          <h3 id="tasks-title" className="text-sm font-bold uppercase tracking-[0.14em] text-slate">Needs attention</h3>
          {tasks.map((t) => (
            <Notice key={t.id} tone={t.tone} title={t.title}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{t.body}</span>
                <Link href={t.href} className="shrink-0 font-bold underline-offset-2 hover:underline">{t.cta} →</Link>
              </div>
            </Notice>
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Today">
        <StatTile label="Bookings today" value={today.bookings} hint={`${today.remaining.length} still to come`} />
        <StatTile label="Court use today" value={pct(today.utilization)} hint={`${today.hours.toFixed(0)} of ${(club.closeHour - club.openHour) * club.courts.length} court-hours`} tone={today.utilization >= 0.5 ? "success" : undefined} />
        <StatTile label="Bookings this week" value={week.bookings} hint={<Change value={week.bookingsChange} />} />
        <StatTile label="Your share this week" value={money(week.paidOutKr)} hint={<span className="flex flex-wrap items-center gap-x-2"><Change value={week.paidOutChange} /><span className="text-slate">paid bookings, after RacketBuddy’s fee</span></span>} tone="court" />
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="card-flat min-w-0" aria-labelledby="today-title">
          <div className="flex items-center justify-between gap-3">
            <h3 id="today-title" className="display text-title">Today’s courts</h3>
            <Link href="/admin/bookinger" className="text-sm font-semibold text-court">All bookings →</Link>
          </div>
          {today.remaining.length === 0 ? (
            <p className="mt-4 text-sm text-slate">{today.bookings > 0 ? "Everything booked for today has been played." : "No bookings on the calendar for the rest of today."}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate/10">
              {today.remaining.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="data w-24 shrink-0 font-bold">{time(b.startsAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.courtName}</span>
                    <span className="block truncate text-slate">{b.userName}</span>
                  </span>
                  <span className="data text-slate">{money(b.priceKr)}</span>
                  {b.needsClubEntry && !b.clubEnteredAt && (
                    <form action={markClubEntered}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="btn-soft btn-sm">Entered</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-flat min-w-0" aria-labelledby="week-title">
          <div className="flex items-center justify-between gap-3">
            <h3 id="week-title" className="display text-title">Last 14 days</h3>
            <span className="text-sm text-slate">Court use this week <span className="font-bold text-ink">{pct(week.utilization)}</span> <span className="text-slate-light">(last week {pct(week.utilizationLastWeek)})</span></span>
          </div>
          <div className="mt-4">
            <TrendBars days={week.trend} timeZone={club.timeZone} />
          </div>
          <p className="mt-3 text-xs text-slate">Confirmed bookings per day in {club.timeZone.replace("_", " ")}. Darker bars are this week.</p>
        </section>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="card-flat min-w-0 overflow-hidden" aria-labelledby="upcoming-title">
          <h3 id="upcoming-title" className="display text-title">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate">No confirmed bookings in the next week yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate/10">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0"><span className="block truncate font-semibold">{dayLabel(b.startsAt)}</span><span className="data block text-slate">{time(b.startsAt)}</span></span>
                  <span className="min-w-0 flex-1 truncate">{b.courtName} · {b.userName}</span>
                  {b.needsClubEntry && !b.clubEnteredAt ? <span className="badge-warning shrink-0">To enter</span> : <span className="data shrink-0 text-slate">{money(b.priceKr)}</span>}
                </li>
              ))}
            </ul>
          )}
          {toEnter.length > 0 && <p className="mt-3 text-xs text-slate">{toEnter.length} {toEnter.length === 1 ? "booking" : "bookings"} still to enter in your own system.</p>}
        </section>

        <section className="card-flat min-w-0" aria-labelledby="actions-title">
          <h3 id="actions-title" className="display text-title">Quick actions</h3>
          <div className="mt-3 grid min-w-0 gap-2">
            {[
              { href: "/admin/tider", icon: "clock" as const, label: "Release times to guests", body: "Weekly rules or single hours" },
              { href: "/admin/bookinger", icon: "calendar" as const, label: "Add a recurring reservation", body: "Same court, same weekday" },
              { href: "/admin/baner", icon: "court" as const, label: "Courts and pricing", body: `${club.courts.length} ${club.courts.length === 1 ? "court" : "courts"} · from ${money(Math.min(club.priceHour, ...club.courts.map((c) => c.priceHour ?? club.priceHour)))}/hr` },
              { href: `/clubs/${club.slug}`, icon: "website" as const, label: "View your public page", body: `racketbuddy.app/klub/${club.slug}` },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate/15 px-3 py-3 transition-colors hover:border-ink">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mist text-court-dark"><Icon name={a.icon} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{a.label}</span><span className="block truncate text-xs text-slate">{a.body}</span></span>
                <Icon name="chevron" size={16} className="text-slate" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
