import {
  ClubControlError,
  unlockDoorForBooking,
} from "../../../../../../lib/club-control";
import { AccessError, unlockKisiForBooking } from "../../../../../../lib/access";
import {
  apiError,
  json,
  preflight,
  requireUser,
} from "../../../../../../lib/api/helpers";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

/** POST /api/v1/bookings/:id/door — kort, servergodkendt dørpuls. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  try {
    return json(await unlockDoorForBooking(auth.user.id, id));
  } catch (error) {
    // No Shelly door at this club: maybe the door is on Kisi.
    if (error instanceof ClubControlError && error.status === 409) {
      try { return json(await unlockKisiForBooking(auth.user.id, id)); }
      catch (e) { if (e instanceof AccessError && e.status !== 409) return apiError(e.message, e.status); }
    }
    if (error instanceof ClubControlError) {
      return apiError(error.message, error.status);
    }
    console.error("Døråbning fejlede:", error);
    return apiError("Døren kunne ikke åbnes. Prøv igen, eller kontakt klubben.", 502);
  }
}
