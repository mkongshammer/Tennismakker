// Places to play that can't be booked on RacketBuddy yet. Plain links, no
// client code: each card opens the place's own page.
import Link from "next/link";
import type { NearbyListing } from "../../lib/places";
import { sportLabel, sportColor } from "../../lib/sports";
import { formatDistance } from "../../lib/us-distance";
import { Icon } from "../ui";

export function PlaceCard({ place }: { place: NearbyListing }) {
  return (
    <Link href={`/places/${place.slug}`} className="card-interactive flex h-full items-start gap-3 rounded-2xl border border-slate/10 bg-chalk p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: sportColor(place.sports[0]) }} aria-hidden="true">
        <Icon name="court" size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-bold leading-tight">{place.name}</span>
        <span className="mt-0.5 block truncate text-sm text-slate">
          {place.city}, {place.state}
          {place.distanceMiles != null && place.distanceMiles >= 1 && <span className="font-semibold text-ink"> · {formatDistance(place.distanceMiles)}</span>}
        </span>
        <span className="mt-1 block truncate text-sm text-slate">{place.sports.map((s) => sportLabel(s, "en-US")).join(" · ")}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <span className="badge-neutral">Not bookable here yet</span>
          {place.votes > 0 && <span className="badge-success">{place.votes} {place.votes === 1 ? "player wants" : "players want"} to book</span>}
        </span>
      </span>
      <Icon name="chevron" className="mt-1 shrink-0 text-slate" />
    </Link>
  );
}

export function PlaceList({ places }: { places: NearbyListing[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {places.map((p) => <li key={p.slug}><PlaceCard place={p} /></li>)}
    </ul>
  );
}
