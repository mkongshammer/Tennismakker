"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapClub } from "./clubTypes";
import { SURFACES } from "../lib/levels";

// Leaflet kræver window, så kortet må ikke renderes på serveren.
const ClubMapView = dynamic(() => import("./ClubMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#EDEBE5] text-sm text-net/50">
      Henter kort
    </div>
  ),
});

/** Banemotiv i klubbens farve — vi har ingen fotos, så banen selv er billedet. */
function CourtGraphic({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="72" fill={color} />
      <g stroke="#FAF7F0" fill="none" opacity="0.9" strokeWidth="1.5">
        {/* doublebane, singlesidelinjer, servefelter */}
        <rect x="14" y="10" width="92" height="52" />
        <line x1="14" y1="17" x2="106" y2="17" />
        <line x1="14" y1="55" x2="106" y2="55" />
        <line x1="38" y1="17" x2="38" y2="55" />
        <line x1="82" y1="17" x2="82" y2="55" />
        <line x1="38" y1="36" x2="82" y2="36" />
      </g>
      {/* nettet står på tværs og rager ud over sidelinjerne */}
      <line x1="60" y1="6" x2="60" y2="66" stroke="#FAF7F0" strokeWidth="2.6" />
    </svg>
  );
}

function Rating({ average, count }: { average: number; count: number }) {
  if (count === 0) return <span className="text-sm text-net/45">Ny på RacketBuddy</span>;
  return (
    <span className="text-sm">
      <span className="text-grus">★</span> {average.toFixed(1)}{" "}
      <span className="text-net/45">({count})</span>
    </span>
  );
}

export function ClubExplorer({ clubs }: { clubs: MapClub[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false); // kun mobil
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const mappable = clubs.filter((c) => c.latitude != null && c.longitude != null);

  // Vælges en klub på kortet, skal kortet i listen også være synligt
  useEffect(() => {
    if (!activeId) return;
    cardRefs.current[activeId]?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [activeId]);

  const list = (
    <ul className="space-y-4">
      {clubs.map((club) => {
        const active = club.id === activeId;
        return (
          <li
            key={club.id}
            ref={(el) => {
              cardRefs.current[club.id] = el;
            }}
            onMouseEnter={() => setActiveId(club.id)}
            onMouseLeave={() => setActiveId(null)}
          >
            <Link
              href={`/klub/${club.slug}`}
              onFocus={() => setActiveId(club.id)}
              className={`flex gap-3 rounded-xl border bg-white p-3 transition-shadow sm:gap-4 ${
                active ? "border-grus shadow-md" : "border-net/10"
              }`}
            >
              <div className="h-[64px] w-[96px] shrink-0 overflow-hidden rounded-lg sm:h-[72px] sm:w-[120px]">
                <CourtGraphic color={club.color} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-bold">{club.name}</p>
                  <Rating average={club.rating.average} count={club.rating.count} />
                </div>
                <p className="truncate text-sm text-net/60">
                  {club.address ? `${club.address}, ` : ""}
                  {club.city}
                </p>
                <p className="mt-1 text-sm text-net/60">
                  {club.courtCount} baner ·{" "}
                  {club.surfaces.map((s) => SURFACES[s] ?? s).join(", ")}
                </p>
                <p className="mt-2">
                  <span className="font-bold">fra {club.priceHour} kr</span>
                  <span className="text-net/60"> / time</span>
                  {club.guestSlotsToday > 0 && (
                    <span className="ml-2 rounded-full bg-grus/10 px-2 py-0.5 text-xs font-bold text-grus-deep">
                      {club.guestSlotsToday} ledige i dag
                    </span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Bred skærm: listen til venstre, kortet bliver hængende til højre */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div>{list}</div>
        <div className="sticky top-6 h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-net/10">
          {mappable.length > 0 ? (
            <ClubMapView clubs={mappable} activeId={activeId} onSelect={setActiveId} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-net/50">
              Ingen klubber har en adresse endnu.
            </div>
          )}
        </div>
      </div>

      {/* Telefon: listen som udgangspunkt, kortet på en knap */}
      <div className="lg:hidden">
        {showMap ? (
          <div className="h-[70vh] overflow-hidden rounded-xl border border-net/10">
            {mappable.length > 0 ? (
              <ClubMapView clubs={mappable} activeId={activeId} onSelect={setActiveId} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-net/50">
                Ingen klubber har en adresse endnu.
              </div>
            )}
          </div>
        ) : (
          list
        )}

        <div className="sticky bottom-[max(1.25rem,env(safe-area-inset-bottom))] mt-5 flex justify-center">
          <button
            onClick={() => setShowMap((v) => !v)}
            className="min-h-[44px] rounded-full bg-bane px-6 py-3 font-semibold text-kridt shadow-lg"
          >
            {showMap ? "Vis liste" : "Vis kort"}
          </button>
        </div>
      </div>
    </>
  );
}
