import { json, preflight, publicUser, requireUser } from "../../../../lib/api/helpers";
import { db } from "../../../../lib/db";
import { eraseAccount } from "../../../../lib/erasure";

export const dynamic = "force-dynamic";
export async function OPTIONS() { return preflight(); }

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  return json({ user: publicUser(auth.user) });
}

/**
 * Lukker brugerens konto. Brugerindhold og personlige profiloplysninger
 * slettes; gennemførte booking-/betalingsrelationer bliver kun stående under
 * en anonymiseret bruger, så lovpligtig dokumentation ikke mister referencer.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  // Moderationsmetadata indeholder bruger-id'er i blokeringer og rapporter.
  // Fjern disse ved kontosletning, så de ikke fortsat kan knyttes til personen.
  await db.platformSetting.deleteMany({
    where: {
      OR: [
        { key: { startsWith: `moderation:block:${auth.user.id}:` } },
        { key: { endsWith: `:${auth.user.id}`, startsWith: "moderation:block:" } },
        {
          AND: [
            { key: { startsWith: "moderation:report:" } },
            { value: { contains: auth.user.id } },
          ],
        },
      ],
    },
  });

  await eraseAccount(auth.user.id);
  return json({ ok: true });
}
