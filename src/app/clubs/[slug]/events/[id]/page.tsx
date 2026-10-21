import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/session";
import { getPreferences } from "../../../../../lib/preferences";
import { formatDate, formatMoney } from "../../../../../lib/international";
import { EVENT_KIND_LABEL, type EventKind } from "../../../../../lib/events";
import { joinEventAction, withdrawEventAction } from "../../../../../lib/event-actions";
import { joinEventWaitlist } from "../../../../../lib/waitlist-actions";
import { sportLabel } from "../../../../../lib/sports";
import { Icon } from "../../../../../components/ui";
import { tournamentView } from "../../../../../lib/tournament";
import { TournamentDraw, MatchSchedule } from "../../../../../components/TournamentDraw";
import { FORMAT_LABEL } from "../../../../../lib/tournament-draw";

export const dynamic = "force-dynamic";

export default async function EventPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ signup?: string; error?: string; venteliste?: string }> }) {
  const [{ slug, id }, q] = await Promise.all([params, searchParams]);
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const ev = await db.clubEvent.findFirst({ where: { id, club: { slug } }, include: { club: { select: { name: true, slug: true, timeZone: true, currency: true } }, _count: { select: { signups: { where: { status: "PAID" } } } } } });
  if (!ev) notFound();
  const mine = user ? await db.eventSignup.findUnique({ where: { eventId_userId: { eventId: id, userId: user.id } } }) : null;
  const onWaitlist = user ? await db.waitlist.findFirst({ where: { userId: user.id, kind: "EVENT", eventId: id } }) : null;
  const participants = await db.eventSignup.findMany({ where: { eventId: id, status: "PAID" }, include: { user: { select: { name: true } } }, orderBy: { paidAt: "asc" } });
  const full = ev.capacity > 0 && ev._count.signups >= ev.capacity;
  const closed = !ev.active || ev.startsAt < new Date() || Boolean(ev.signupClosesAt && ev.signupClosesAt < new Date());
  const locale = prefs.locale, tz = ev.club.timeZone;
  const d = (x: Date, o: Intl.DateTimeFormatOptions) => formatDate(x, locale, tz, o);
  const joined = mine?.status === "PAID";
  const draw = ev.drawnAt ? await tournamentView(ev.id) : null;
  const drawView = draw ? { ...draw, matches: draw.matches.map((m) => ({ ...m, when: m.scheduledAt ? d(m.scheduledAt, { weekday: "short", hour: "numeric", minute: "2-digit" }) : null })) } : null;
  const myNext = drawView?.matches.find((m) => m.status === "PENDING" && m.home && m.away && user && (m.home.userId === user.id || m.away.userId === user.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clubs/${slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-court"><Icon name="chevron" size={16} className="rotate-180" />{ev.club.name}</Link>
      <header className="rounded-3xl bg-ink p-6 text-white sm:p-8">
        <p className="eyebrow text-white/60">{EVENT_KIND_LABEL[ev.kind as EventKind] ?? "Event"} · {sportLabel(ev.sport as any, "en-US")}</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{ev.name}</h1>
        <p className="mt-3 text-white/80">{d(ev.startsAt, { weekday: "long", month: "long", day: "numeric" })} · {d(ev.startsAt, { hour: "numeric", minute: "2-digit" })} – {d(ev.endsAt, { hour: "numeric", minute: "2-digit" })}</p>
        <p className="mt-1 text-white/80">{ev.priceKr > 0 ? formatMoney(ev.priceKr, ev.club.currency, locale) : "Free"} · {ev._count.signups}{ev.capacity ? ` of ${ev.capacity}` : ""} signed up{ev.format !== "NONE" ? ` · ${FORMAT_LABEL[ev.format as keyof typeof FORMAT_LABEL] ?? ev.format}` : ""}</p>
      </header>
      {ev.description && <p className="whitespace-pre-line leading-relaxed">{ev.description}</p>}

      {q.signup === "ok" && <p className="rounded-xl bg-success-soft p-4 text-sm font-semibold text-success-ink">You're in. A confirmation is on its way by e-mail.</p>}
      {q.signup === "withdrawn" && <p className="rounded-xl bg-mist p-4 text-sm">You've withdrawn from this event.</p>}
      {q.venteliste && <p className="rounded-xl bg-court-tint p-4 text-sm font-semibold text-court-dark">You're on the waitlist. We'll e-mail and push you if a spot opens.</p>}
      {q.error && <p role="alert" className="rounded-xl bg-[#fdeee8] p-4 text-sm font-semibold text-[#a2401c]">{q.error}</p>}

      <div className="card">
        {joined ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold"><Icon name="check" size={18} className="mr-1 inline text-success" />You're signed up.</p>
            {(ev.priceKr === 0 || mine!.priceKr === 0) && ev.startsAt > new Date() && <form action={withdrawEventAction}><input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="slug" value={slug} /><button className="btn-ghost btn-sm">Withdraw</button></form>}
          </div>
        ) : closed ? <p className="text-slate">Sign-up is closed.</p>
        : !user ? <Link href={`/login?next=${encodeURIComponent(`/clubs/${slug}/events/${ev.id}`)}`} className="btn-court">Log in to sign up</Link>
        : full ? (
          onWaitlist ? <p className="text-slate">Full. You're on the waitlist.</p>
          : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-slate">This event is full.</p><form action={joinEventWaitlist}><input type="hidden" name="eventId" value={ev.id} /><button className="btn-ghost">Join the waitlist</button></form></div>
        ) : (
          <form action={joinEventAction} className="flex flex-wrap items-center justify-between gap-3">
            <input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="slug" value={slug} />
            <p className="text-slate">{ev.priceKr > 0 ? `Pay ${formatMoney(ev.priceKr, ev.club.currency, locale)} by card. Paid straight to the club.` : "No charge."}</p>
            <button className="btn-court">{ev.priceKr > 0 ? `Sign up · ${formatMoney(ev.priceKr, ev.club.currency, locale)}` : "Sign up"}</button>
          </form>
        )}
      </div>

      {drawView && (
        <section id="draw" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="display text-xl">Draw and schedule</h2><a className="text-sm font-semibold text-court" href={`/clubs/${slug}/events/${ev.id}/schedule`}>Printable schedule</a></div>
          {myNext && <p className="rounded-xl bg-court-tint p-4 text-sm font-semibold text-court-dark">Your next match: {myNext.when ?? "time to be set"}{myNext.courtName ? ` on ${myNext.courtName}` : ""} against {myNext.home!.userId === user!.id ? myNext.away!.name : myNext.home!.name}.</p>}
          <TournamentDraw {...drawView} meUserId={user?.id ?? null} />
        </section>
      )}
      {!drawView && ev.format !== "NONE" && joined && <p className="text-sm text-slate">The draw and match schedule will appear here once the club has made the draw. You'll get an e-mail with your first match time.</p>}

      {participants.length > 0 && (
        <section><h2 className="display mb-2 text-xl">Who's in</h2><ul className="flex flex-wrap gap-2">{participants.map((p) => <li key={p.id} className="rounded-full bg-chalk px-3 py-1 text-sm">{p.user.name}</li>)}</ul></section>
      )}
    </div>
  );
}
