import { json, preflight } from "../../../../lib/api/helpers";
import { discoverClubs, parseDiscoveryFilters } from "../../../../lib/discovery";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/**
 * GET /api/v1/clubs?sport=TENNIS&q=Boston&indoor=1&today=1&max=40&radius=50&page=1
 *
 * Approved US clubs only, with the same search the website uses: a city,
 * state or ZIP resolves to a point and results carry distance in miles.
 * The `land` parameter from older apps is ignored — public discovery is
 * never driven by a client-provided market.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = (process.env.APP_URL ?? url.origin).replace(/\/+$/, "");
  const query = Object.fromEntries(url.searchParams.entries());
  const filters = parseDiscoveryFilters(query);
  const result = await discoverClubs(filters);

  return json({
    place: result.place ? { label: result.place.label, latitude: result.place.latitude, longitude: result.place.longitude, kind: result.place.kind, state: result.place.state, alternatives: result.place.alternatives ?? [] } : null,
    placeUnresolved: result.placeUnresolved,
    totalForSport: result.totalForSport,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.page * result.pageSize < result.total,
    clubs: result.clubs.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      distanceMiles: c.distanceMiles,
      color: c.color,
      priceHour: c.priceFrom,
      country: c.country,
      currency: c.currency,
      timeZone: c.timeZone,
      courtCount: c.courtCount,
      indoorCount: c.indoorCount,
      surfaces: c.surfaces,
      rating: c.rating,
      bookable: c.bookable,
      slotsToday: c.slotsToday,
      nextSlotAt: c.nextSlotAt,
      tagline: c.tagline,
      heroId: c.heroId,
      heroUrl: c.heroId ? `${origin}/api/billeder/${c.heroId}?w=480` : null,
    })),
  });
}
