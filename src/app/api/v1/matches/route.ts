import { db } from "../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../lib/api/helpers";
import { userFromRequest } from "../../../../lib/session";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** GET /api/v1/matches?omraade=&niveau= — åbne makker-opslag. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const area = url.searchParams.get("omraade")?.trim();
  const levelParam = url.searchParams.get("niveau");
  const level = levelParam ? Number(levelParam) : null;
  const me = await userFromRequest(req);

  const requests = await db.matchRequest.findMany({
    where: {
      status: "OPEN",
      ...(area ? { area: { contains: area, mode: "insensitive" } } : {}),
      ...(level ? { level: { gte: level - 1, lte: level + 1 } } : {}),
    },
    include: { requester: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({
    matches: requests.map((r: any) => ({
      id: r.id,
      message: r.message,
      area: r.area,
      level: r.level,
      matchType: r.matchType,
      createdAt: r.createdAt.toISOString(),
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
  if (!message || !area) return apiError("Skriv en besked og et område.");

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
