import { db } from "../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../lib/api/helpers";
import { userFromRequest } from "../../../../lib/session";
import { isDanishRegion, regionForArea } from "../../../../lib/regions";
import { blockedUserIds, objectionableContentReason } from "../../../../lib/moderation";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/matches?region=&niveau= — åbne makker-opslag. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawRegion = (url.searchParams.get("region") ?? url.searchParams.get("omraade") ?? "").trim();
  const selectedRegion = isDanishRegion(rawRegion) ? rawRegion : regionForArea(rawRegion) ?? "";
  const levelParam = url.searchParams.get("niveau");
  const level = levelParam ? Number(levelParam) : null;
  const me = await userFromRequest(req);
  const blocked = me ? new Set(await blockedUserIds(me.id)) : new Set<string>();

  const requests = await db.matchRequest.findMany({
    where: {
      status: "OPEN",
      ...(level && level >= 1 && level <= 7 ? { level } : {}),
      ...(blocked.size ? { requesterId: { notIn: [...blocked] } } : {}),
    },
    include: { requester: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const filtered = selectedRegion
    ? requests.filter((request) => regionForArea(request.area) === selectedRegion)
    : requests;

  return json({
    matches: filtered.map((r: any) => ({
      id: r.id,
      message: r.message,
      area: regionForArea(r.area) ?? r.area,
      level: r.level,
      matchType: r.matchType,
      createdAt: r.createdAt.toISOString(),
      requesterId: r.requesterId,
      requesterName: r.requester.name,
      isMine: me ? r.requesterId === me.id : false,
    })),
  });
}

/** POST /api/v1/matches — opret et opslag. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  const area = String(body.area ?? "").trim();
  if (!message) return apiError("Skriv en besked.");
  if (message.length > 1000) return apiError("Opslaget er for langt.");
  const moderationError = objectionableContentReason(message);
  if (moderationError) return apiError(moderationError);
  if (!isDanishRegion(area)) return apiError("Vælg en af de fem danske regioner.");

  const created = await db.matchRequest.create({
    data: {
      message,
      area,
      level: Math.min(7, Math.max(1, Number(body.level ?? auth.user.level))),
      matchType: ["SINGLE", "DOUBLE", "TRAENING"].includes(body.matchType)
        ? body.matchType
        : "SINGLE",
      requesterId: auth.user.id,
    },
  });

  return json({ id: created.id }, 201);
}
