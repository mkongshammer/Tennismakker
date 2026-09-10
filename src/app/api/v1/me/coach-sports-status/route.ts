import { json, preflight, requireUser } from "../../../../../lib/api/helpers";
import { consumeSignupSportsIntent, hasChosenBuddySports } from "../../../../../lib/buddy-sports";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  if (auth.user.role !== "COACH") {
    return json({ needsSelection: false });
  }

  // Nye trænere har allerede valgt sportsgrene i signup. Flyt det valg over
  // til den permanente markering første gang appen ser dem efter login.
  await consumeSignupSportsIntent(auth.user);

  const chosen = await hasChosenBuddySports(auth.user.id);
  return json({ needsSelection: !chosen });
}
