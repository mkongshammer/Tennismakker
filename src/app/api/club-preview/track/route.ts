// Heartbeats and clicks from club preview pages and the signup that follows.
import { NextResponse } from "next/server";
import { track, type TrackEvent } from "../../../../lib/preview-tracking";
import { getCurrentUser } from "../../../../lib/session";

export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (text.length > 4000) return NextResponse.json({ ok: false }, { status: 413 });
  let ev: TrackEvent;
  try { ev = JSON.parse(text) as TrackEvent; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|preview|scanner|headless/i.test(ua)) return NextResponse.json({ ok: true });
  if ((await getCurrentUser().catch(() => null))?.role === "SUPERADMIN") return NextResponse.json({ ok: true });
  await track(ev, ua).catch((e) => console.error("[preview-track]", e));
  return NextResponse.json({ ok: true });
}
