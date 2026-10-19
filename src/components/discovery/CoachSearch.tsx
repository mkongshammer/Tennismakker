"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SPORTS, sportColor, sportLabel, type Sport } from "../../lib/sports";
import { Icon } from "../ui";

export function CoachSearch({ q: initial, sport: initialSport }: { q: string; sport: Sport }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initial);
  const [sport, setSport] = useState<Sport>(initialSport);
  const go = (next: { q?: string; sport?: Sport }) =>
    start(() => {
      const params = new URLSearchParams();
      const query = next.q ?? q;
      const s = next.sport ?? sport;
      if (query) params.set("q", query);
      if (s !== "TENNIS") params.set("sport", s);
      router.push(`/coaches${params.toString() ? `?${params}` : ""}`);
    });

  return (
    <form
      role="search"
      aria-label="Find coaches"
      className="min-w-0 max-w-full rounded-3xl border border-slate/15 bg-chalk p-3 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        go({});
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-h-14 flex-1 items-center rounded-2xl bg-mist px-4 focus-within:shadow-ring">
          <span className="sr-only">Where do you want lessons?</span>
          <Icon name="pin" className="mr-3 shrink-0 text-slate" />
          <input name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="City, state or ZIP" maxLength={120} enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-light" />
          {q && (
            <button type="button" aria-label="Clear location" onClick={() => setQ("")} className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-chalk">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        <button type="submit" className="btn-court min-h-14 rounded-2xl sm:min-w-36" aria-busy={pending}>
          <Icon name="search" /> {pending ? "Searching…" : "Search"}
        </button>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1">
        <div className="flex w-max gap-2" role="group" aria-label="Sport">
          {SPORTS.map((s) => (
            <button key={s} type="button" aria-pressed={sport === s} onClick={() => { setSport(s); go({ sport: s }); }} className="pill">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sportColor(s) }} />
              {sportLabel(s, "en-US")}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
