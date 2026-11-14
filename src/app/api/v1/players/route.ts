import { db } from "../../../../lib/db";
import { notErased } from "../../../../lib/erasure";
import { json, preflight, requireUser } from "../../../../lib/api/helpers";
import { blockedUserIds } from "../../../../lib/moderation";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/players — liste over spillere, der er oprettet på RacketBuddy. */
export async function GET(req: Request) {
  try {
    return await listGET(req);
  } catch (e) {
    console.error("[api/v1/players] GET failed:", e);
    return json({ error: "Couldn’t load players right now. Try again in a moment." }, 500);
  }
}

async function listGET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const rawRegion = (url.searchParams.get("region") ?? url.searchParams.get("omraade") ?? "").trim();
  const selectedRegion = rawRegion;
  const sport = url.searchParams.get("sport")?.trim().toUpperCase();
  const blocked = await blockedUserIds(auth.user.id);

  const users = await db.user.findMany({
    where: {
      id: { notIn: [auth.user.id, ...blocked] },
      role: { in: ["PLAYER", "COACH"] },
      ...notErased,
      country: "US",
      ...(sport ? { sports: { contains: sport, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      name: true,
      level: true,
      area: true,
      bio: true,
      sports: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });

  const filtered = selectedRegion
    ? users.filter((user) => user.area?.toLocaleLowerCase().includes(selectedRegion.toLocaleLowerCase()))
    : users;

  return json({
    players: filtered.slice(0, 100).map((u) => ({
      id: u.id,
      name: u.name,
      level: u.level,
      area: u.area,
      bio: u.bio,
      sports: (u.sports ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      isCoach: u.role === "COACH",
    })),
  });
}
