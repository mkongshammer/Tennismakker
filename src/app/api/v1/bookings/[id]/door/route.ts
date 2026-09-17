import {
  ClubControlError,
  unlockDoorForBooking,
} from "../../../../../../lib/club-control";
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
    if (error instanceof ClubControlError) {
      return apiError(error.message, error.status);
    }
    console.error("Døråbning fejlede:", error);
    return apiError("Døren kunne ikke åbnes. Prøv igen, eller kontakt klubben.", 502);
  }
}
