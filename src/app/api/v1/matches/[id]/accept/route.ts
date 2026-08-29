import { db } from "../../../../../../lib/db";
import { apiError, json, preflight, requireUser } from "../../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** POST /api/v1/matches/[id]/accept — slå til på et opslag og få kontaktinfo. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const request = await db.matchRequest.findUnique({
    where: { id: params.id },
    include: { requester: true },
  });
  if (!request) return apiError("Opslaget findes ikke.", 404);
  if (request.status !== "OPEN") return apiError("Opslaget er ikke længere åbent.");
  if (request.requesterId === auth.user.id) {
    return apiError("Du kan ikke slå til på dit eget opslag.");
  }

  await db.matchRequest.update({
    where: { id: params.id },
    data: { status: "MATCHED", acceptedById: auth.user.id },
  });

  // Kontaktoplysninger deles ikke længere automatisk — samtalen sker i appen
  return json({
    threadId: request.id,
    otherName: request.requester.name,
  });
}
