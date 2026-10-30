import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/session";
import { createCoachCampaign } from "../../../../lib/instantly-coach-campaign";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new NextResponse("Not found", { status: 404 });
  try { return NextResponse.json(await createCoachCampaign()); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 }); }
}
