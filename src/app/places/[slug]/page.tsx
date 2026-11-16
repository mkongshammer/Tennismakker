// A place to play that isn't bookable on RacketBuddy yet.
//
// Honest about what it is: we know the club exists and what is played there,
// and that is all. The page sends players to the club's own site for now,
// lets them say "I want to book here" (the count is what we show the club),
// and lets the owner claim it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listingBySlug, placesNear, listingStateName } from "../../../lib/places";
import { resolvePlace } from "../../../lib/us-places";
import { sportLabel, sportColor } from "../../../lib/sports";
import { getCurrentUser } from "../../../lib/session";
import { getSettings } from "../../../lib/settings";
import { db } from "../../../lib/db";
import { norm } from "../../../lib/club-votes";
import { PlaceList } from "../../../components/discovery/PlaceList";
import { Icon } from "../../../components/ui";
import { PlaceVote } from "./PlaceVote";

export const dynamic = "force-dynamic";

const sportsText = (sports: string[]) => {
  const names = sports.map((s) => sportLabel(s, "en-US").toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const place = await listingBySlug((await params).slug);
  if (!place) return { title: "Place not found", robots: { index: false } };
  return {
    title: `${place.name} · ${sportsText(place.sports)} in ${place.city}, ${place.state}`,
    description: `${place.name} in ${place.city}, ${listingStateName(place)}: ${sportsText(place.sports)}. Not bookable on RacketBuddy yet. Ask the club to open online booking, or find courts, coaches and players nearby.`,
    alternates: { canonical: `/places/${place.slug}` },
  };
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await listingBySlug(slug);
  if (!place) notFound();
  // Joined since the list was built? Then the real, bookable club page is the right place.
  const live = await db.club.findMany({ where: { status: "APPROVED", country: "US", city: { equals: place.city, mode: "insensitive" } }, select: { name: true, slug: true } }).catch(() => []);
  const joined = live.find((c) => norm(c.name) === norm(place.name));
  if (joined) redirect(`/clubs/${joined.slug}`);

  const [user, center, { appUrl }] = await Promise.all([getCurrentUser(), resolvePlace(`${place.city}, ${place.state}`).catch(() => null), getSettings()]);
  const nearby = center ? (await placesNear(center, null, 25, 7)).listings.filter((p) => p.slug !== place.slug).slice(0, 6) : [];
  const where = `${place.city}, ${place.state}`;
  const sport = place.sports[0];
  const claim = `/list-your-club?${new URLSearchParams({ club: place.name, city: place.city, state: place.state })}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "SportsActivityLocation", name: place.name,
    address: { "@type": "PostalAddress", addressLocality: place.city, addressRegion: place.state, addressCountry: "US" },
    ...(place.website ? { sameAs: place.website } : {}), url: `${appUrl.replace(/\/+$/, "")}/places/${place.slug}`,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-slate">
        <Link href="/courts" className="hover:text-ink">Courts</Link> <span aria-hidden="true">/</span>{" "}
        <Link href={`/courts?q=${encodeURIComponent(where)}&sport=${sport}`} className="hover:text-ink">{where}</Link>
      </nav>

      <header className="card-flat px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {place.sports.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-slate/15 px-3 py-1 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sportColor(s) }} aria-hidden="true" />{sportLabel(s, "en-US")}
            </span>
          ))}
          <span className="badge-neutral">Not bookable on RacketBuddy yet</span>
        </div>
        <h1 className="display mt-3 text-display-md sm:text-display-lg">{place.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-slate"><Icon name="pin" size={18} /> {place.city}, {listingStateName(place)}</p>
        <p className="mt-4 max-w-2xl text-slate">
          {place.name} offers {sportsText(place.sports)} in {place.city}. The club hasn’t opened online booking on RacketBuddy, so for now you book through the club itself.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {place.website && (
            <a href={place.website} target="_blank" rel="nofollow noopener noreferrer" className="btn-ghost"><Icon name="website" /> Visit the club’s website</a>
          )}
          <Link href={`/courts?q=${encodeURIComponent(where)}&sport=${sport}`} className="btn-ghost"><Icon name="search" /> More courts near {place.city}</Link>
        </div>
      </header>

      <section className="card-flat px-6 py-7 sm:px-8">
        <h2 className="display text-title">Want to book {place.name} online?</h2>
        <p className="mt-1 max-w-2xl text-slate">
          {place.votes > 0
            ? `${place.votes} ${place.votes === 1 ? "player has" : "players have"} asked already. Add your name and we’ll let the club know.`
            : "Be the first to ask. When enough players do, we let the club know its players want to book online."}
        </p>
        <div className="mt-5 max-w-xl"><PlaceVote slug={place.slug} sport={sport} email={user?.email ?? ""} clubName={place.name} /></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href={`/coaches?q=${encodeURIComponent(where)}&sport=${sport}`} className="card-interactive card-flat flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf3e6] text-grass"><Icon name="coach" size={24} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">Find a coach near {place.city}</span><span className="block text-sm text-slate">Book a lesson and pay online.</span></span>
          <Icon name="chevron" className="text-slate" />
        </Link>
        <Link href="/players" className="card-interactive card-flat flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e5] text-clay"><Icon name="players" size={24} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">Find someone to play with</span><span className="block text-sm text-slate">Players at your level, and a chat to set up a game.</span></span>
          <Icon name="chevron" className="text-slate" />
        </Link>
      </section>

      {nearby.length > 0 && (
        <section>
          <h2 className="display mb-3 text-title">More places to play near {place.city}</h2>
          <PlaceList places={nearby} />
        </section>
      )}

      <aside className="card-dark flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Do you run {place.name}?</p>
          <p className="text-sm text-white/70">Claim this page and take bookings and payments online. Set up in minutes, one plan with everything included.</p>
        </div>
        <Link href={claim} className="btn-court shrink-0">Claim this club</Link>
      </aside>
      <p className="text-center text-xs text-slate">
        This page was made from public information and isn’t run by the club. Something wrong, or want it removed?{" "}
        <a href={`mailto:hello@racketbuddy.app?subject=${encodeURIComponent(`Listing: ${place.name}, ${where}`)}`} className="underline underline-offset-2">Email hello@racketbuddy.app</a> and we’ll fix it.
      </p>
    </div>
  );
}
