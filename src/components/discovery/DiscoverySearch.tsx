"use client";

// Court search. A plain GET form so every search is a shareable URL and
// the back button works: /courts?q=Boston&sport=PICKLEBALL&today=1.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SPORTS, sportColor, sportLabel, type Sport } from "../../lib/sports";
import { discoveryHref, type DiscoveryFilters } from "../../lib/discovery-filters";
import { Icon } from "../ui";

const PRICE_STEPS = [25, 40, 60, 100] as const;

export function DiscoverySearch({ filters, compact = false, action = "/courts", placeholder = "City, state or ZIP", radiusApplies = true }: { filters: DiscoveryFilters; compact?: boolean; action?: string; placeholder?: string; /** False for a whole-state search, where distance is not the filter. */ radiusApplies?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [sport, setSport] = useState<Sport>(filters.sport);

  // Any change to the search resets paging; page 3 of a different query is meaningless.
  const go = (next: Partial<DiscoveryFilters>) => start(() => router.push(discoveryHref({ ...filters, q, sport, page: 1, ...next }, action)));

  return (
    <form
      role="search"
      aria-label="Find courts"
      className="min-w-0 max-w-full rounded-3xl border border-slate/15 bg-chalk p-3 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        go({ q, sport });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-h-14 flex-1 items-center rounded-2xl bg-mist px-4 focus-within:shadow-ring">
          <span className="sr-only">Where do you want to play?</span>
          <Icon name="pin" className="mr-3 shrink-0 text-slate" />
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            autoComplete="postal-code"
            enterKeyHint="search"
            maxLength={120}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-light"
          />
          {q && (
            <button type="button" aria-label="Clear location" onClick={() => setQ("")} className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-chalk">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        <button type="submit" className="btn-court min-h-14 rounded-2xl sm:min-w-36" aria-busy={pending}>
          <Icon name="search" />
          {pending ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1">
        <div className="flex w-max gap-2" role="group" aria-label="Sport">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sport === s}
              onClick={() => {
                setSport(s);
                go({ sport: s });
              }}
              className="pill"
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sportColor(s) }} />
              {sportLabel(s, "en-US")}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate/10 pt-3 text-sm">
          <span className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-slate">Filters</span>
          <button type="button" aria-pressed={filters.today} onClick={() => go({ today: !filters.today })} className="pill min-h-9 text-xs">
            <Icon name="clock" size={14} /> Available today
          </button>
          <button type="button" aria-pressed={filters.indoor} onClick={() => go({ indoor: !filters.indoor })} className="pill min-h-9 text-xs">
            <Icon name="roof" size={14} /> Indoor
          </button>
          <label className="pill min-h-9 cursor-pointer text-xs">
            <Icon name="dollar" size={14} />
            <span className="sr-only">Maximum price per hour</span>
            <select
              value={filters.maxPrice ?? ""}
              onChange={(e) => go({ maxPrice: e.target.value ? Number(e.target.value) : null })}
              className="bg-transparent text-xs font-semibold outline-none"
              style={{ fontSize: 16 }}
            >
              <option value="">Any price</option>
              {PRICE_STEPS.map((p) => (
                <option key={p} value={p}>Up to ${p}/hr</option>
              ))}
            </select>
          </label>
          {filters.q && radiusApplies && (
            <label className="pill min-h-9 cursor-pointer text-xs">
              <Icon name="map" size={14} />
              <span className="sr-only">Search radius</span>
              <select value={filters.radiusMiles} onChange={(e) => go({ radiusMiles: Number(e.target.value) })} className="bg-transparent text-xs font-semibold outline-none" style={{ fontSize: 16 }}>
                {[10, 25, 50, 100, 250].map((r) => (
                  <option key={r} value={r}>Within {r} mi</option>
                ))}
              </select>
            </label>
          )}
          {(filters.today || filters.indoor || filters.maxPrice) && (
            <button type="button" onClick={() => go({ today: false, indoor: false, maxPrice: null })} className="ml-auto text-xs font-semibold text-slate underline-offset-2 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}
    </form>
  );
}
