"use client";

// Leaflet kræver window, så kortet må ikke renderes på serveren.
import dynamic from "next/dynamic";
import type { MapClub } from "./ClubMapView";

const ClubMapView = dynamic(() => import("./ClubMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-net/5 text-sm text-net/50">
      Henter kort…
    </div>
  ),
});

export function ClubMap({ clubs }: { clubs: MapClub[] }) {
  if (clubs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-net/5 p-6 text-center text-sm text-net/50">
        Ingen klubber har en adresse endnu, så der er ikke noget at vise på kortet.
      </div>
    );
  }
  return <ClubMapView clubs={clubs} />;
}
