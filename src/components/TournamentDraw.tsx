// The draw as people read it on a club noticeboard: group tables with
// their matches, then the bracket as columns from first round to final.
// No hooks, so it renders on the server for the public page and inside the
// client-side admin panel with result forms slotted in.
import type { ReactNode } from "react";

export type DrawMatchView = {
  id: string; stage: string; group: string | null; round: number; slot: number; roundName: string;
  home: { id: string; name: string; userId: string } | null; away: { id: string; name: string; userId: string } | null;
  homeFrom: string | null; awayFrom: string | null; winnerId: string | null; score: string | null; status: string;
  when: string | null; courtName: string | null;
};
export type DrawGroupView = { letter: string; table: { id: string; name: string; userId: string; played: number; wins: number; losses: number; points: number; setsFor: number; setsAgainst: number }[] };

type Props = { matches: DrawMatchView[]; groups: DrawGroupView[]; koRounds: number; champion: { name: string } | null; meUserId?: string | null; renderResult?: (m: DrawMatchView) => ReactNode; t?: (s: string) => string };

function Side({ side, from, winner, me }: { side: DrawMatchView["home"]; from: string | null; winner: boolean; me: boolean }) {
  return (
    <span className={`flex items-center justify-between gap-2 ${winner ? "font-bold" : side ? "" : "text-slate"} ${me ? "text-court" : ""}`}>
      <span className="truncate">{side ? side.name : from ? `Group ${from[0]} · ${from[1] === "1" ? "winner" : "runner-up"}` : "—"}</span>
      {winner && <span aria-hidden className="text-success">✓</span>}
    </span>
  );
}

export function MatchCard({ m, meUserId, renderResult }: { m: DrawMatchView; meUserId?: string | null; renderResult?: (m: DrawMatchView) => ReactNode }) {
  const mine = Boolean(meUserId && (m.home?.userId === meUserId || m.away?.userId === meUserId));
  return (
    <div className={`rounded-xl border p-3 text-sm ${mine ? "border-court/30 bg-court-tint/40" : "border-slate/15 bg-chalk"}`}>
      {m.status === "BYE" ? <p className="text-slate">{(m.home ?? m.away)?.name ?? "—"} · bye</p> : (
        <div className="space-y-1">
          <Side side={m.home} from={m.homeFrom} winner={Boolean(m.winnerId) && m.winnerId === m.home?.id} me={Boolean(meUserId && m.home?.userId === meUserId)} />
          <Side side={m.away} from={m.awayFrom} winner={Boolean(m.winnerId) && m.winnerId === m.away?.id} me={Boolean(meUserId && m.away?.userId === meUserId)} />
        </div>
      )}
      {m.status !== "BYE" && <p className="mt-2 text-xs text-slate">{m.score ? <span className="font-semibold text-ink">{m.score} · </span> : null}{m.when ?? ""}{m.courtName ? ` · ${m.courtName}` : ""}</p>}
      {renderResult && m.status !== "BYE" && m.home && m.away && <div className="mt-2">{renderResult(m)}</div>}
    </div>
  );
}

export function TournamentDraw({ matches, groups, koRounds, champion, meUserId, renderResult, t = (s) => s }: Props) {
  const ko = matches.filter((m) => m.stage === "KO");
  const rounds = Array.from({ length: koRounds }, (_, i) => i + 1);
  return (
    <div className="space-y-6">
      {champion && <p className="rounded-2xl bg-optic px-4 py-3 text-sm font-bold text-ink">🏆 {t("Winner")}: {champion.name}</p>}
      {groups.map((g) => {
        const gm = matches.filter((m) => m.stage === "GROUP" && (m.group ?? "") === g.letter);
        const byRound = [...new Set(gm.map((m) => m.round))].sort((a, b) => a - b);
        return (
          <section key={g.letter || "rr"} className="space-y-3">
            <h3 className="display text-lg">{g.letter ? `${t("Group")} ${g.letter}` : t("Round robin")}</h3>
            <div className="overflow-x-auto rounded-xl border border-slate/15">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="px-3 py-2">#</th><th className="px-3 py-2">{t("Player")}</th><th className="px-3 py-2 text-right">P</th><th className="px-3 py-2 text-right">W</th><th className="px-3 py-2 text-right">L</th><th className="px-3 py-2 text-right">{t("Sets")}</th><th className="px-3 py-2 text-right">{t("Pts")}</th></tr></thead>
                <tbody>
                  {g.table.map((r, i) => <tr key={r.id} className={`border-t border-slate/10 ${i < 2 && ko.length ? "font-semibold" : ""} ${meUserId === r.userId ? "text-court" : ""}`}><td className="px-3 py-2 text-slate">{i + 1}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-right">{r.played}</td><td className="px-3 py-2 text-right">{r.wins}</td><td className="px-3 py-2 text-right">{r.losses}</td><td className="px-3 py-2 text-right">{r.setsFor}–{r.setsAgainst}</td><td className="px-3 py-2 text-right font-bold">{r.points}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byRound.map((r) => (
                <div key={r} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate">{t("Round")} {r}</p>
                  {gm.filter((m) => m.round === r).map((m) => <MatchCard key={m.id} m={m} meUserId={meUserId} renderResult={renderResult} />)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {ko.length > 0 && (
        <section className="space-y-3">
          <h3 className="display text-lg">{groups.length ? t("Knockout") : t("Bracket")}</h3>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {rounds.map((r) => (
                <div key={r} className="flex w-60 flex-col justify-around gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate">{t(ko.find((m) => m.round === r)?.roundName ?? `Round ${r}`)}</p>
                  {ko.filter((m) => m.round === r).map((m) => <MatchCard key={m.id} m={m} meUserId={meUserId} renderResult={renderResult} />)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** The whole thing as a flat, printable list in time order. */
export function MatchSchedule({ matches, t = (s) => s }: { matches: DrawMatchView[]; t?: (s: string) => string }) {
  const timed = matches.filter((m) => m.status !== "BYE" && m.when).sort((a, b) => (a.stage === b.stage ? a.round - b.round || a.slot - b.slot : a.stage === "GROUP" ? -1 : 1));
  if (!timed.length) return null;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 pr-3">{t("Time")}</th><th className="py-2 pr-3">{t("Court")}</th><th className="py-2 pr-3">{t("Match")}</th><th className="py-2">{t("Stage")}</th></tr></thead>
      <tbody>{timed.map((m) => <tr key={m.id} className="border-t border-slate/10"><td className="py-2 pr-3 whitespace-nowrap">{m.when}</td><td className="py-2 pr-3">{m.courtName}</td><td className="py-2 pr-3">{m.home?.name ?? (m.homeFrom ? `${m.homeFrom[0]}${m.homeFrom[1]}` : "?")} – {m.away?.name ?? (m.awayFrom ? `${m.awayFrom[0]}${m.awayFrom[1]}` : "?")}{m.score ? <span className="text-slate"> · {m.score}</span> : null}</td><td className="py-2 text-slate">{m.group ? `${t("Group")} ${m.group}` : m.roundName}</td></tr>)}</tbody>
    </table>
  );
}
