import { json, preflight, publicUser, requireUser } from "../../../../lib/api/helpers";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  return json({ user: publicUser(auth.user) });
}

/**
 * Lukker brugerens konto og fjerner de personoplysninger, der ikke skal
 * bevares. Historiske booking-/betalingsrelationer bliver stående under en
 * anonymiseret bruger, så regnskab og allerede gennemførte bookinger ikke
 * mister deres referencer.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const deletedEmail = `deleted-${auth.user.id}@deleted.racketbuddy.invalid`;

  await db.user.update({
    where: { id: auth.user.id },
    data: {
      email: deletedEmail,
      name: "Slettet bruger",
      phone: null,
      area: null,
      bio: null,
      clubId: null,
      stripeCustomerId: null,
      country: "DK",
      countryChosen: false,
      locale: "da",
      sports: "TENNIS",
      role: "PLAYER",
    },
  });

  return json({ ok: true });
}
