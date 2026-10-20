import { json, preflight } from "../../../../lib/api/helpers";
import { suggestCities } from "../../../../lib/us-places";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/places?q=bos — real US cities for the "City or area" field (web and app). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ places: await suggestCities(q) }, 200);
}
