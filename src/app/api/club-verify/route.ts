// Confirms a club's contact e-mail from the link in the sign-up e-mail.
import { db } from "../../../lib/db";
import { markEmailVerified, tokenMatches } from "../../../lib/club-signup-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clubId = url.searchParams.get("c") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const club = clubId ? await db.club.findUnique({ where: { id: clubId }, select: { id: true, contactEmail: true } }).catch(() => null) : null;
  const ok = Boolean(club?.contactEmail && tokenMatches(club.id, club.contactEmail, token));
  if (ok) await markEmailVerified(club!.id);
  const base = (process.env.APP_URL ?? url.origin).replace(/\/$/, "");
  return Response.redirect(`${base}/club-start?email=${ok ? "confirmed" : "invalid"}`, 303);
}
