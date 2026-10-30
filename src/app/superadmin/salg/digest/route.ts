// Send the daily sales e-mail now (superadmin), to check it.
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/session";
import { runDailySalesDigest } from "../../../../lib/sales-digest";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new NextResponse("Not found", { status: 404 });
  const r = await runDailySalesDigest(new Date(), true);
  return NextResponse.json({ sent: r.sent, reason: "reason" in r ? r.reason : undefined, recipients: "recipients" in r ? r.recipients : 0 });
}
