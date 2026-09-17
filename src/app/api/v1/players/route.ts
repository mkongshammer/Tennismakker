import { db } from "../../../../lib/db";
import { json, preflight, requireUser } from "../../../../lib/api/helpers";
import { isDanishRegion, regionForArea } from "../../../../lib/regions";
import { blockedUserIds, objectionableContentReason } from "../../../../lib/moderation";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/players — liste over spillere, der er oprettet på RacketBuddy. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const rawRegion = (url.searchParams.get("region") ?? url.searchParams.get("omraade") ?? "").trim();
  const selectedRegion = isDanishRegion(rawRegion) ? rawRegion : regionForArea(rawRegion) ?? "";
  const sport = url.searchParams.get("sport")?.trim().toUpperCase();
  const blocked = await blockedUserIds(auth.user.id);

  const users = await db.user.findMany({
    where: {
      id: { not: auth.user.id, ...(blocked.length ? { notIn: blocked } : {}) },
      role: { in: ["PLAYER", "COACH"] },
      country: auth.user.country,
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
    ? users.filter((user) => regionForArea(user.area) === selectedRegion)
    : users;

  return json({
    players: filtered.slice(0, 100).map((u) => ({
      id: u.id,
      name: u.name,
      level: u.level,
      area: regionForArea(u.area) ?? u.area,
      bio: u.bio && !objectionableContentReason(u.bio) ? u.bio : null,
      sports: u.sports.split(",").map((s) => s.trim()).filter(Boolean),
      isCoach: u.role === "COACH",
    })),
  });
}
