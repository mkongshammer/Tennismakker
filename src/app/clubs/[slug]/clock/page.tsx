// The time clock on the desk tablet. Staff type their PIN; the same PIN
// clocks them in and out. No login: the club's slug and a PIN are enough,
// and the page shows nothing but first names and times.
import { notFound } from "next/navigation";
import { db } from "../../../../lib/db";
import { formatDate } from "../../../../lib/international";
import { onTheClock } from "../../../../lib/payroll";
import { punchAction } from "../../../../lib/payroll-actions";
import { workedMinutes, hoursLabel } from "../../../../lib/payroll-core";

export const dynamic = "force-dynamic";

export default async function ClockPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const club = await db.club.findUnique({ where: { slug }, select: { id: true, name: true, timeZone: true, solutionMode: true } });
  if (!club || club.solutionMode !== "CUSTOM") notFound();
  const working = await onTheClock(club.id);
  const t = (d: Date) => formatDate(d, "en-US", club.timeZone, { hour: "numeric", minute: "2-digit" });
  const at = q.at ? new Date(q.at) : null;
  const since = q.since ? new Date(q.since) : null;
  return (
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      <p className="eyebrow">{club.name}</p>
      <h1 className="display text-3xl">Time clock</h1>
      {q.who && at && (
        <div className={`rounded-2xl p-5 ${q.dir === "in" ? "bg-success-soft text-success-ink" : "bg-court-tint text-court-dark"}`} role="status">
          <p className="text-xl font-bold">{q.who}: clocked {q.dir} at {t(at)}</p>
          {since && <p className="mt-1 text-sm">Worked {hoursLabel(workedMinutes({ staffId: "", clockIn: since, clockOut: at, breakMinutes: 0 }))} since {t(since)}.{q.capped ? " The entry was closed at 16 hours; ask the manager to correct it." : ""}</p>}
        </div>
      )}
      {q.error && <p role="alert" className="rounded-2xl bg-danger-soft p-4 font-semibold text-danger-ink">{q.error}</p>}
      <form action={punchAction} className="card space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <label className="label block text-left">Your PIN
          <input className="input text-center text-3xl tracking-[0.5em]" name="pin" inputMode="numeric" pattern="[0-9]{4,6}" autoComplete="off" autoFocus required maxLength={6} />
        </label>
        <button className="btn-ink w-full text-lg">Clock in / out</button>
        <p className="hint">One tap does both: in if you're out, out if you're in.</p>
      </form>
      <section className="card text-left">
        <h2 className="font-bold">On the clock now</h2>
        {working.length === 0 ? <p className="mt-1 text-sm text-slate">Nobody.</p> : (
          <ul className="mt-2 divide-y divide-slate/10 text-sm">{working.map((w) => <li key={w.id} className="flex justify-between py-2"><span>{w.staff.name}{w.staff.role ? <span className="text-slate"> · {w.staff.role}</span> : null}</span><span className="text-slate">since {t(w.clockIn)}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
