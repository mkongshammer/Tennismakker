// Superadmin: put the founding-club wording into the Instantly sales e-mails
// (or back to the regular price). POST ?mode=founding|regular.
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/session";
import { setCampaignPriceCopy } from "../../../../lib/founding-offer";
import { foundingStatus } from "../../../../lib/club-onboarding";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const mode = new URL(req.url).searchParams.get("mode") === "regular" ? "regular" : "founding";
  return NextResponse.json({ status: await foundingStatus(), ...(await setCampaignPriceCopy(mode)) });
}
