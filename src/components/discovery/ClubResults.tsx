"use client";

// Discovery results: a list of club cards synced with the map.
// Wide screens: list left, sticky map right. Phones: list first, map
// behind one button. Favorites live in localStorage per browser — a light
// convenience, not an account feature, until accounts carry favorites.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapClub } from "../clubTypes";
import { formatMoney, formatDate } from "../../lib/international";
import { surfaceLabel } from "../../lib/sports";
import { formatDistance } from "../../lib/us-places";
import { Icon } from "../ui";

const ClubMapView = dynamic(() => import("../ClubMapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-2xl" />,
});

const FAVORITES_KEY = "rb_favorite_clubs";
function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function CourtGraphic({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="72" fill={color} />
      <g stroke="#FAF7F0" fill="none" opacity="0.9" strokeWidth="1.5">
        <rect x="14" y="10" width="92" height="52" />
        <line x1="14" y1="17" x2="106" y2="17" />
        <line x1="14" y1="55" x2="106" y2="55" />
        <line x1="38" y1="17" x2="38" y2="55" />
        <line x1="82" y1="17" x2="82" y2="55" />
        <line x1="38" y1="36" x2="82" y2="36" />
      </g>
      <line x1="60" y1="6" x2="60" y2="66" stroke="#FAF7F0" strokeWidth="2.6" />
    </svg>
  );
}

export function ClubCard({ club, active, favorite, onFavorite, onHover }: { club: MapClub; active: boolean; favorite: boolean; onFavorite: () => void; onHover: (id: string | null) => void }) {
  const next = club.nextSlotAt ? new Date(club.nextSlotAt) : null;
  return (
    <li onMouseEnter={() => onHover(club.id)} onMouseLeave={() => onHover(null)} className="relative">
      <Link
        href={`/klub/${club.slug}`}
        onFocus={() => onHover(club.id)}
        className={`card-interactive flex gap-4 rounded-2xl border bg-chalk p-3 sm:p-4 ${active ? "border-court shadow-lift" : "border-slate/10"}`}
      >
        <div className="h-[72px] w-[108px] shrink-0 overflow-hidden rounded-xl sm:h-[84px] sm:w-[128px]">
          <CourtGraphic color={club.color} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 pr-9">
            <p className="truncate text-base font-bold leading-tight">{club.name}</p>
            {club.rating.count > 0 ? (
              <span className="shrink-0 text-sm">
                <span className="text-court">★</span> {club.rating.average.toFixed(1)} <span className="text-slate-light">({club.rating.count})</span>
              </span>
            ) : (
              <span className="badge-neutral shrink-0">New</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate">
            {club.city}
            {club.state ? `, ${club.state}` : ""}
            {club.distanceMiles != null && <span className="font-semibold text-ink"> · {formatDistance(club.distanceMiles)}</span>}
          </p>
          <p className="mt-1 truncate text-sm text-slate">
            {club.courtCount} {club.courtCount === 1 ? "court" : "courts"}
            {club.indoorCount ? ` · ${club.indoorCount} indoor` : ""}
            {club.surfaces.length ? ` · ${club.surfaces.map((s) => surfaceLabel(s, "en-US")).join(", ")}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm">
              <span className="font-bold">from {formatMoney(club.priceHour, club.currency, "en-US")}</span>
              <span className="text-slate"> / hour</span>
            </span>
            {!club.bookable ? (
              <span className="badge-neutral">Not bookable yet</span>
            ) : club.guestSlotsToday > 0 ? (
              <span className="badge-success">
                {club.guestSlotsToday} open today{next ? ` · next ${formatDate(next, "en-US", club.timeZone ?? "America/New_York", { hour: "numeric", minute: "2-digit" })}` : ""}
              </span>
            ) : (
              <span className="badge-neutral">Nothing open today</span>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${club.name} from favorites` : `Save ${club.name} to favorites`}
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${favorite ? "bg-court text-chalk" : "bg-mist text-slate hover:text-ink"}`}
      >
        <Icon name="heart" size={18} strokeWidth={favorite ? 2.4 : 1.8} />
      </button>
    </li>
  );
}

export function ClubResults({ clubs, origin }: { clubs: MapClub[]; origin: { latitude: number; longitude: number; label: string } | null }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const mappable = clubs.filter((c) => c.latitude != null && c.longitude != null);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!activeId) return;
    cardRefs.current[activeId]?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [activeId]);

  const sorted = [...clubs].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));

  const list = (
    <ul className="space-y-3">
      {sorted.map((club) => (
        <div key={club.id} ref={(el) => { cardRefs.current[club.id] = el; }}>
          <ClubCard club={club} active={club.id === activeId} favorite={favorites.includes(club.id)} onFavorite={() => toggleFavorite(club.id)} onHover={setActiveId} />
        </div>
      ))}
    </ul>
  );

  const map = mappable.length > 0 ? (
    <ClubMapView clubs={mappable} activeId={activeId} onSelect={setActiveId} origin={origin} />
  ) : (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate">No club has shared a map location yet.</div>
  );

  return (
    <>
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_1.05fr]">
        <div>{list}</div>
        <div className="sticky top-24 h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-slate/10">{map}</div>
      </div>

      <div className="lg:hidden">
        {showMap ? <div className="h-[70vh] overflow-hidden rounded-2xl border border-slate/10">{map}</div> : list}
        <div className="sticky bottom-[max(1.25rem,calc(var(--tab-bar-h)+env(safe-area-inset-bottom)+0.75rem))] mt-5 flex justify-center">
          <button onClick={() => setShowMap((v) => !v)} className="btn-ink btn-pill shadow-pop">
            <Icon name={showMap ? "list" : "map"} />
            {showMap ? "Show list" : "Show map"}
          </button>
        </div>
      </div>
    </>
  );
}
