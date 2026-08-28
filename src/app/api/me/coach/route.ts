import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.coachProfile) {
    return NextResponse.json({ error: "Du har ikke en trænerprofil." }, { status: 403 });
  }
  return NextResponse.json(user.coachProfile);
}
