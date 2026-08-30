import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/session";
import { refreshAccountStatus } from "../../../../../lib/connect";

// Kaldes af trænerprofilen, når Stripe sender træneren tilbage efter
// onboarding — så statussen er opdateret med det samme, i stedet for at
// vente på webhooken (som også opdaterer den, men uden en fast tidsgaranti).
export async function POST() {
  const user = await getCurrentUser();
  if (!user?.coachProfile) {
    return NextResponse.json({ error: "Ingen trænerprofil." }, { status: 403 });
  }
  const status = await refreshAccountStatus("COACH", user.coachProfile.id).catch(() => null);
  return NextResponse.json({ status });
}
