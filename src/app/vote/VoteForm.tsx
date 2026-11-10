"use client";
// Pick your club (from our list, with search) or type it in, add your email, vote.
import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { voteForClub, type VoteState } from "../../lib/club-vote-actions";
import { SubmitButton } from "../../components/SubmitButton";
import { Select } from "../../components/ui/Select";
import { Icon } from "../../components/ui";
import { US_STATES } from "../../../shared/us-address.mjs";

type Choice = { id: string; name: string; city: string; state: string };
const SPORT_OPTIONS: [string, string][] = [["TENNIS", "Tennis"], ["PICKLEBALL", "Pickleball"], ["PADEL", "Padel"], ["SQUASH", "Squash"], ["BADMINTON", "Badminton"], ["BORDTENNIS", "Table tennis"]];

export function VoteForm({ email = "", initialQuery = "" }: { email?: string; initialQuery?: string }) {
  const [state, action] = useFormState<VoteState, FormData>(voteForClub, null);
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Choice[]>([]);
  const [picked, setPicked] = useState<Choice | null>(null);
  const [manual, setManual] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (picked || manual) return;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/club-vote/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ clubs: [] }));
      setResults(res.clubs ?? []);
      setSearched(true);
    }, 220);
  }, [q, picked, manual]);

  if (state?.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-sm text-success-ink">
        <Icon name="check" className="mt-0.5 shrink-0" />
        <p>{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={action} className="relative space-y-4">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {!manual && (
        <div>
          <label className="label" htmlFor="vote-q">Which club?</label>
          {picked ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-court/40 bg-court/10 px-4 py-3">
              <div className="min-w-0"><p className="truncate font-bold">{picked.name}</p><p className="text-sm text-slate">{[picked.city, picked.state].filter(Boolean).join(", ")}</p></div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setPicked(null); setResults([]); }}>Change</button>
              <input type="hidden" name="clubId" value={picked.id} />
            </div>
          ) : (
            <>
              <input id="vote-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Club name or city, e.g. Riverside Racquet Austin" autoComplete="off" maxLength={80} />
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-slate/10 overflow-hidden rounded-2xl border border-slate/15">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-court/10" onClick={() => setPicked(c)}>
                        <span className="min-w-0"><span className="block truncate font-semibold">{c.name}</span><span className="block text-sm text-slate">{[c.city, c.state].filter(Boolean).join(", ")}</span></span>
                        <Icon name="chevron" className="shrink-0 text-slate" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searched && results.length === 0 && <p className="hint">No match on our list.</p>}
              <button type="button" className="mt-2 text-sm font-semibold text-court-light underline-offset-2 hover:underline" onClick={() => setManual(true)}>My club isn’t listed</button>
            </>
          )}
        </div>
      )}

      {manual && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="label">Club name</span><input className="input" name="name" required maxLength={120} defaultValue={q} /></label>
          <label><span className="label">City</span><input className="input" name="city" required maxLength={80} /></label>
          <label><span className="label">State</span>
            <Select className="input" name="state" required defaultValue="">
              <option value="" disabled>Choose</option>
              {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </Select>
          </label>
          <button type="button" className="text-left text-sm font-semibold text-court-light underline-offset-2 hover:underline sm:col-span-2" onClick={() => setManual(false)}>Search our list instead</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <label><span className="label">Sport</span>
          <Select className="input" name="sport" defaultValue="TENNIS">
            {SPORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </label>
        <label><span className="label">Your email</span><input className="input" name="email" type="email" autoComplete="email" required defaultValue={email} placeholder="you@example.com" /></label>
      </div>

      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <SubmitButton className="btn-court w-full justify-center sm:w-auto" pendingText="Voting…" disabled={!manual && !picked}>
        <Icon name="heart" /> Vote for this club
      </SubmitButton>
      <p className="hint">Only confirmed emails count, so clubs know the votes are real. We email you once, when the club goes live. No newsletter.</p>
    </form>
  );
}
