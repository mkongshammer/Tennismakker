import { json, preflight, requireUser } from "../../../../lib/api/helpers";
import { nextCandidates, pendingLikes, recordSwipe } from "../../../../lib/swipe";
import { apiError } from "../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/swipe — næste spillere at tage stilling til. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const [candidates, likes] = await Promise.all([
    nextCandidates(auth.user.id, 10),
    pendingLikes(auth.user.id),
  ]);

  return json({
    pendingLikes: likes,
    players: candidates.map((p: any) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      area: p.area,
      bio: p.bio,
      isCoach: p.role === "COACH",
    })),
  });
}

/** POST /api/v1/swipe — registrér et ja eller nej. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const toUserId = String(body.toUserId ?? "");
  if (!toUserId) return apiError("Angiv toUserId.");

  const result = await recordSwipe(auth.user.id, toUserId, Boolean(body.liked));
  return json(result);
}
