import { NextResponse } from "next/server";
import { confirmVote } from "../../../../lib/club-votes";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = await confirmVote(url.searchParams.get("k") ?? "", url.searchParams.get("t") ?? "").catch(() => "invalid" as const);
  return NextResponse.redirect(new URL(`/vote?vote=${result}`, url.origin));
}
