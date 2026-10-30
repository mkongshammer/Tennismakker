// Club leads as a CSV for Instantly. ?new=1 = only those not yet pushed or
// downloaded, and marks them downloaded.
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { allLeads, leadsCsv, type LeadKind } from "../../../../lib/lead-harvest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new NextResponse("Not found", { status: 404 });
  const params = new URL(req.url).searchParams;
  const onlyNew = params.get("new") === "1";
  const kind: LeadKind = params.get("kind") === "coach" ? "coach" : "club";
  const rows = (await allLeads(kind)).filter((r) => !onlyNew || (!r.lead.pushedAt && !r.lead.exportedAt));
  if (onlyNew) {
    const at = new Date().toISOString();
    for (const r of rows) await db.platformSetting.update({ where: { key: r.key }, data: { value: JSON.stringify({ ...r.lead, exportedAt: at }) } });
  }
  return new NextResponse(leadsCsv(rows.map((r) => r.lead)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="racketbuddy-${kind}-leads${onlyNew ? "-new" : ""}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
