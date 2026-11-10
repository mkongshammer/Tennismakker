import { NextResponse } from "next/server";
import { searchVoteClubs } from "../../../../lib/club-votes";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const clubs = await searchVoteClubs(q.slice(0, 80)).catch(() => []);
  return NextResponse.json({ clubs }, { headers: { "cache-control": "private, max-age=60" } });
}
