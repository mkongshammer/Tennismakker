import { db } from "../../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** POST /api/v1/players/:id/contact — åbn eller genbrug en direkte samtale. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const otherId = params.id;
  if (!otherId || otherId === auth.user.id) return apiError("Ugyldig spiller.");

  const other = await db.user.findFirst({
    where: {
      id: otherId,
      role: { in: ["PLAYER", "COACH"] },
      country: auth.user.country,
    },
    select: { id: true, name: true, level: true, area: true, sports: true },
  });
  if (!other) return apiError("Spilleren findes ikke.", 404);

  const existing = await db.matchRequest.findFirst({
    where: {
      source: "DIRECT",
      OR: [
        { requesterId: auth.user.id, acceptedById: other.id },
        { requesterId: other.id, acceptedById: auth.user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return json({ threadId: existing.id, otherName: other.name });
  }

  const sport = other.sports.split(",").map((s) => s.trim()).find(Boolean) ?? "TENNIS";
  const thread = await db.matchRequest.create({
    data: {
      status: "MATCHED",
      message: `Samtale med ${other.name}`,
      area: other.area ?? auth.user.area ?? "Danmark",
      level: other.level,
      sport,
      matchType: "TRAENING",
      source: "DIRECT",
      requesterId: auth.user.id,
      acceptedById: other.id,
    },
  });

  return json({ threadId: thread.id, otherName: other.name }, 201);
}
