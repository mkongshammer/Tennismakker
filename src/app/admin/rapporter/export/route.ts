// CSV download of the club's revenue lines. ?format=quickbooks gives the
// 3-column file QuickBooks Online imports as bank transactions.
import { getCurrentUser } from "../../../../lib/session";
import { db } from "../../../../lib/db";
import { revenueLines, toCsv, toQuickBooksCsv } from "../../../../lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLUB_ADMIN" || !user.clubId) return new Response("Forbidden", { status: 403 });
  const club = await db.club.findUnique({ where: { id: user.clubId }, select: { timeZone: true, slug: true } });
  if (!club) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 400 * 86_400_000) return new Response("Bad range", { status: 400 });
  const lines = await revenueLines(user.clubId, from, to, club.timeZone);
  const quickbooks = url.searchParams.get("format") === "quickbooks";
  const body = quickbooks ? toQuickBooksCsv(lines, club.timeZone) : toCsv(lines, club.timeZone);
  const name = `${club.slug}-revenue-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}${quickbooks ? "-quickbooks" : ""}.csv`;
  return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}
