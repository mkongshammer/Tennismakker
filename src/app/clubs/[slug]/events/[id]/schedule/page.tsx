// The match schedule on one page, for the noticeboard and the desk.
import { notFound } from "next/navigation";
import { db } from "../../../../../../lib/db";
import { getPreferences } from "../../../../../../lib/preferences";
import { formatDate } from "../../../../../../lib/international";
import { tournamentView } from "../../../../../../lib/tournament";
import { MatchSchedule, TournamentDraw } from "../../../../../../components/TournamentDraw";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const prefs = await getPreferences();
  const ev = await db.clubEvent.findFirst({ where: { id, club: { slug } }, include: { club: { select: { name: true, timeZone: true } } } });
  if (!ev || !ev.drawnAt) notFound();
  const draw = await tournamentView(ev.id);
  const view = { ...draw, matches: draw.matches.map((m) => ({ ...m, when: m.scheduledAt ? formatDate(m.scheduledAt, prefs.locale, ev.club.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null })) };
  return (
    <div className="mx-auto max-w-4xl space-y-8 print:max-w-none">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{ev.club.name}</p><h1 className="display text-3xl">{ev.name}</h1><p className="text-slate">{formatDate(ev.startsAt, prefs.locale, ev.club.timeZone, { weekday: "long", month: "long", day: "numeric" })}</p></div>
        <a href={`/clubs/${slug}/events/${id}`} className="btn-ghost btn-sm print:hidden">Back to the event</a>
      </header>
      <section className="card"><h2 className="display mb-3 text-xl">Schedule</h2><MatchSchedule matches={view.matches} /></section>
      <TournamentDraw {...view} />
    </div>
  );
}
