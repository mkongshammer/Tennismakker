"use client";

// Court search. A plain GET form so every search is a shareable URL and
// the back button works: /courts?q=Boston&sport=PICKLEBALL&today=1.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SPORTS, sportColor, sportLabel, type Sport } from "../../lib/sports";
import { discoveryHref, DEFAULT_RADIUS_MILES, type DiscoveryFilters } from "../../lib/discovery-filters";
import { Icon } from "../ui";
import { PillMenu } from "../ui/PillMenu";

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
      <div className="flex gap-2">
        <label className="relative flex min-h-14 min-w-0 flex-1 items-center rounded-2xl bg-mist px-4 focus-within:shadow-ring">
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
        <button type="submit" className="btn-court min-h-14 w-14 shrink-0 rounded-2xl px-0 sm:w-auto sm:min-w-36 sm:px-5" aria-busy={pending} aria-label={pending ? "Searching" : "Search"}>
          <Icon name="search" />
          <span className="hidden sm:inline">{pending ? "Searching…" : "Search"}</span>
        </button>
      </div>

      {/* Every sport is visible without scrolling: one line that shrinks to
          fit on wider cards, two rows of three on phones (see .sport-chips). */}
      <div className="sport-chips-wrap mt-3">
        <div className="sport-chips" role="group" aria-label="Sport">
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
              <span aria-hidden="true" className="sport-dot h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sportColor(s) }} />
              <span className="truncate">{sportLabel(s, "en-US")}</span>
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto border-t border-slate/10 px-1 pt-3 text-sm sm:overflow-visible">
        <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
          <span className="mr-1 hidden text-xs font-bold uppercase tracking-[0.14em] text-slate sm:inline">Filters</span>
          <button type="button" aria-pressed={filters.today} onClick={() => go({ today: !filters.today })} className="pill min-h-9 shrink-0 text-xs">
            <Icon name="clock" size={14} /> Available today
          </button>
          <button type="button" aria-pressed={filters.indoor} onClick={() => go({ indoor: !filters.indoor })} className="pill min-h-9 shrink-0 text-xs">
            <Icon name="roof" size={14} /> Indoor
          </button>
          <PillMenu
            className="shrink-0"
            srLabel="Maximum price per hour"
            icon={<Icon name="dollar" size={14} />}
            value={filters.maxPrice ?? 0}
            label={filters.maxPrice ? `Up to $${filters.maxPrice}/hr` : "Any price"}
            options={[{ value: 0, label: "Any price" }, ...PRICE_STEPS.map((p) => ({ value: p, label: `Up to $${p}`, hint: "per hour" }))]}
            onChange={(v) => go({ maxPrice: v ? Number(v) : null })}
          />
          {filters.q && radiusApplies && (
            <PillMenu
              className="shrink-0"
              srLabel="Search radius"
              icon={<Icon name="map" size={14} />}
              value={filters.radiusMiles}
              defaultValue={DEFAULT_RADIUS_MILES}
              label={`Within ${filters.radiusMiles} mi`}
              options={[10, 25, 50, 100, 250].map((r) => ({ value: r, label: `Within ${r} miles` }))}
              onChange={(v) => go({ radiusMiles: Number(v) })}
            />
          )}
          {(filters.today || filters.indoor || filters.maxPrice) && (
            <button type="button" onClick={() => go({ today: false, indoor: false, maxPrice: null })} className="shrink-0 text-xs font-semibold text-slate underline-offset-2 hover:underline sm:ml-auto">
              Clear filters
            </button>
          )}
        </div>
        </div>
      )}
    </form>
  );
}
