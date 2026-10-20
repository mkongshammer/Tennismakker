import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";

export const dynamic = "force-dynamic";

// Every club the sales autopilot has emailed, as a CSV Instantly can import
// as a blocklist, so a cold campaign never writes to a club twice.
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function domainOf(website: string) {
  try {
    return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new NextResponse("Not found", { status: 404 });
  const rows = await db.platformSetting.findMany({
    where: { key: { startsWith: "sales:sent:email:" } },
    orderBy: { updatedAt: "asc" },
  });
  const lines = ["email,domain,club_name,website,sent_at"];
  for (const row of rows) {
    let record: { email?: string; website?: string; clubName?: string; sentAt?: string } = {};
    try { record = JSON.parse(row.value); } catch { continue; }
    if (!record.email) continue;
    const website = record.website ?? "";
    lines.push([record.email, domainOf(website), record.clubName, website, record.sentAt].map(csvCell).join(","));
  }
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="racketbuddy-blocklist-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
