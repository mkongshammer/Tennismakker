// Live view of the personal club pages: who is on their page right now, what
// they read, how far they get (into the signup too) and where they stop.
import { funnel, LIVE_MS, PREVIEW_SECTIONS, recentVisits, SECTION_LABELS, SIGNUP_STEPS, stoppedAt } from "../../lib/preview-tracking";
import { AutoRefresh } from "./AutoRefresh";
import { previewFollowups } from "../../lib/club-preview";

const time = (iso: string) => new Date(iso).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (s: number) => (s < 60 ? `${s} sek` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} sek` : ""}`.trim());

export async function PreviewLive() {
  const visits = await recentVisits(80);
  const now = Date.now();
  const live = visits.filter((v) => now - new Date(v.last).getTime() < LIVE_MS);
  const f = funnel(visits);
  const followups = await previewFollowups().catch(() => []);
  const skipReason: Record<string, string> = { suppressed: "har bedt om ikke at blive kontaktet", "signed up": "har allerede tilmeldt sig", "no lead": "klubben findes ikke på listen", "send failed": "afsendelsen fejlede", "said no": "har sagt nej (venter 3 måneder)" };

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl">Lige nu</h2>
          <p className="text-xs text-slate">Opdaterer hvert 10. sekund</p>
        </div>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Ingen klubber er på deres side lige nu.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {live.map((v) => (
              <li key={v.visit} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success-ink">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" aria-hidden="true" /><span className="font-bold">{v.club}</span> <span>· {[v.city, v.state].filter(Boolean).join(", ")} · {v.device}</span></span>
                <span>Læser nu: <span className="font-semibold">{stoppedAt(v)}</span> · {dur(v.active)} på siden · {v.maxScroll}% scrollet</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="display text-xl">Personlig opfølgning</h2>
        <p className="mt-1 text-sm text-slate">Ca. 30 min. efter en klub åbner sin side første gang, får de en kort mail fra magnus@racketbuddy.app med tilbud om at sætte klubben op med deres rigtige baner og priser.</p>
        {followups.length === 0 ? <p className="mt-2 text-sm text-slate">Ingen endnu.</p> : (
          <ul className="mt-3 divide-y divide-slate/10 text-sm">
            {followups.map((x) => (
              <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><span className="font-semibold">{x.club}</span> <span className="text-slate">· {[x.city, x.state].filter(Boolean).join(", ")} · {x.email}</span></span>
                <span className={x.sentAt ? "font-semibold text-success-ink" : "text-slate"}>{x.sentAt ? `Sendt ${time(x.sentAt)}` : x.skipped ? `Ikke sendt: ${skipReason[x.skipped] ?? x.skipped}` : `Sendes ${time(x.due)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="display text-xl">Hvor langt kommer de?</h2>
        <p className="mt-1 text-sm text-slate">Andel af de seneste {f.total} besøg, der nåede hvert afsnit (mindst 1 sek. på skærmen), og videre ind i tilmeldingen. Det store fald viser, hvor siden mister dem.</p>
        <div className="mt-4 space-y-2">
          {f.rows.map((r, i) => {
            const drop = i > 0 ? f.rows[i - 1].pct - r.pct : 0;
            return (
              <div key={r.key} className="grid grid-cols-[10rem_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_6rem]">
                <span className="truncate">{r.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-slate/10"><span className="block h-full rounded-full bg-court" style={{ width: `${r.pct}%` }} /></span>
                <span className="data text-right">{r.pct}%{drop >= 20 ? <span className="ml-1 text-danger">−{drop}</span> : null}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="display text-xl">Seneste besøg</h2>
        {visits.length === 0 ? <p className="mt-2 text-sm text-slate">Ingen besøg endnu. De kommer, når klubberne åbner linket i salgsmailen.</p> : (
          <div className="mt-4 -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate/15 text-left">
                  <th className="py-2 pr-3 font-bold">Klub</th>
                  <th className="py-2 pr-3 font-bold">Hvornår</th>
                  <th className="py-2 pr-3 font-bold">Tid</th>
                  <th className="py-2 pr-3 font-bold">Stoppede ved</th>
                  <th className="py-2 pr-3 font-bold">Læste mest</th>
                  <th className="py-2 font-bold">Klik</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => {
                  const top = PREVIEW_SECTIONS.filter((s) => (v.sections[s] ?? 0) >= 1).sort((a, b) => (v.sections[b] ?? 0) - (v.sections[a] ?? 0)).slice(0, 2);
                  const isLive = now - new Date(v.last).getTime() < LIVE_MS;
                  return (
                    <tr key={v.visit} className="border-b border-slate/10 align-top last:border-0">
                      <td className="py-2 pr-3"><span className="font-semibold">{v.club}</span>{isLive ? <span className="ml-2 badge bg-success-soft text-success-ink">live</span> : null}<span className="block text-xs text-slate">{[v.city, v.state].filter(Boolean).join(", ")} · {v.device}</span></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{time(v.start)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{dur(v.active)}<span className="block text-xs text-slate">{v.maxScroll}% scrollet</span></td>
                      <td className="py-2 pr-3 font-semibold">{stoppedAt(v)}{v.signupStep >= 0 ? <span className="block text-xs font-normal text-slate">Nåede trin {v.signupStep + 1} af {SIGNUP_STEPS.length} i tilmeldingen</span> : null}</td>
                      <td className="py-2 pr-3">{top.map((s) => `${SECTION_LABELS[s]} (${dur(v.sections[s])})`).join(", ") || "—"}</td>
                      <td className="py-2">{v.clicks.length ? v.clicks.map((c) => c.what).join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
