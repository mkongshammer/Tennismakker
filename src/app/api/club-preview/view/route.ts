// Beacon from the club preview page. Only a real browser that stayed on the
// page sends it, so mail-server link scanners don't count as views.
import { NextResponse } from "next/server";
import { recordPreviewView, validPreviewId } from "../../../../lib/club-preview";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String((body as { id?: unknown }).id ?? "");
  if (!validPreviewId(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|preview|scanner|headless/i.test(ua)) return NextResponse.json({ ok: true });
  await recordPreviewView(id).catch((e) => console.error("[club-preview] view", e));
  return NextResponse.json({ ok: true });
}
