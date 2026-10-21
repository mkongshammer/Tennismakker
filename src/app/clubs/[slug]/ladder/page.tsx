import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { ladderStandings } from "../../../../lib/events";
import { joinLadderAction, reportResultAction } from "../../../../lib/event-actions";
import { sportLabel } from "../../../../lib/sports";
import { Icon } from "../../../../components/ui";
import { Select } from "../../../../components/ui/Select";

export const dynamic = "force-dynamic";

export default async function LadderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; reported?: string; l?: string }> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const club = await db.club.findUnique({ where: { slug }, select: { id: true, name: true, ladders: { where: { active: true }, orderBy: { createdAt: "asc" } } } });
  if (!club) notFound();
  const ladder = club.ladders.find((l) => l.id === q.l) ?? club.ladders[0];
  const standings = ladder ? await ladderStandings(ladder.id) : [];
  const me = user ? standings.find((s) => s.userId === user.id) : null;
  const recent = ladder ? await db.ladderMatch.findMany({ where: { ladderId: ladder.id }, orderBy: { playedAt: "desc" }, take: 10 }) : [];
  const names = new Map(standings.map((s) => [s.userId, s.name]));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clubs/${slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-court"><Icon name="chevron" size={16} className="rotate-180" />{club.name}</Link>
      <header>
        <p className="eyebrow text-slate">Ladder</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{ladder ? ladder.name : "No ladder yet"}</h1>
        {ladder && <p className="mt-2 text-slate">{sportLabel(ladder.sport as any, "en-US")} · Beat someone above you and you take their spot. Either player reports the result.</p>}
      </header>
      {club.ladders.length > 1 && <div className="flex flex-wrap gap-2">{club.ladders.map((l) => <Link key={l.id} href={`/clubs/${slug}/ladder?l=${l.id}`} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${l.id === ladder?.id ? "bg-ink text-white" : "bg-chalk"}`}>{l.name}</Link>)}</div>}
      {q.reported && <p className="rounded-xl bg-success-soft p-4 text-sm font-semibold text-success-ink">Result recorded. The ladder is updated.</p>}
      {q.error && <p role="alert" className="rounded-xl bg-[#fdeee8] p-4 text-sm font-semibold text-[#a2401c]">{q.error}</p>}
      {!ladder ? <p className="card text-slate">The club hasn't started a ladder.</p> : (
        <>
          {!me && (
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <p className="text-slate">Join to be placed at the bottom and start challenging.</p>
              {user ? <form action={joinLadderAction}><input type="hidden" name="ladderId" value={ladder.id} /><input type="hidden" name="slug" value={slug} /><button className="btn-court">Join the ladder</button></form> : <Link href={`/login?next=${encodeURIComponent(`/clubs/${slug}/ladder`)}`} className="btn-court">Log in to join</Link>}
            </div>
          )}
          <ol className="divide-y divide-slate/10 overflow-hidden rounded-3xl border border-slate/15 bg-chalk">
            {standings.map((s) => (
              <li key={s.id} className={`flex items-center gap-4 px-4 py-3 ${s.userId === user?.id ? "bg-court-tint/40" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${s.rank === 1 ? "bg-optic text-ink" : "bg-mist text-ink"}`}>{s.rank}</span>
                <span className="min-w-0 flex-1 font-semibold">{s.name}<span className="ml-2 text-xs font-normal text-slate">NTRP-ish level {s.level}</span></span>
                <span className="text-sm text-slate">{s.wins}–{s.losses}</span>
              </li>
            ))}
            {standings.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate">Nobody on the ladder yet. Be the first.</li>}
          </ol>
          {me && standings.length > 1 && (
            <form action={reportResultAction} className="card space-y-3">
              <h2 className="display text-xl">Report a match</h2>
              <input type="hidden" name="ladderId" value={ladder.id} /><input type="hidden" name="slug" value={slug} />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="label block">Opponent<Select className="input" name="opponentId" defaultValue="">{standings.filter((s) => s.userId !== user!.id).map((s) => <option key={s.userId} value={s.userId}>#{s.rank} {s.name}</option>)}</Select></label>
                <label className="label block">Result<Select className="input" name="outcome" defaultValue="won"><option value="won">I won</option><option value="lost">I lost</option></Select></label>
                <label className="label block">Score (optional)<input className="input" name="score" maxLength={40} placeholder="6-4 3-6 10-8" /></label>
              </div>
              <button className="btn-court">Submit result</button>
            </form>
          )}
          {recent.length > 0 && (
            <section><h2 className="display mb-2 text-xl">Recent matches</h2><ul className="divide-y divide-slate/10 text-sm">{recent.map((m) => <li key={m.id} className="flex flex-wrap gap-2 py-2"><span className="font-semibold">{names.get(m.winnerId) ?? "?"}</span><span className="text-slate">beat</span><span className="font-semibold">{names.get(m.loserId) ?? "?"}</span>{m.score && <span className="text-slate">{m.score}</span>}</li>)}</ul></section>
          )}
        </>
      )}
    </div>
  );
}
