// Run one lead-research round now (superadmin), instead of waiting for the hourly job.
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/session";
import { harvestLeads } from "../../../../../lib/lead-harvest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new NextResponse("Not found", { status: 404 });
  const result = await harvestLeads(new Date(), 2);
  return NextResponse.json(result);
}
