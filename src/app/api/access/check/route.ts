// The door asks, we answer. Any controller that can call a URL on a tap
// (a reader with a network module, a Raspberry Pi, an integrator's
// middleware) sends the credential it read; we say allow or deny.
//
//   POST /api/access/check   Authorization: Bearer rbak_…   {"credential":"04A1B2C3","door":"Main"}
//   GET  /api/access/check?key=rbak_…&credential=04A1B2C3&door=Main   (for controllers that can only GET)
//
// Response: {"allow":true,"reason":"Booking in progress","name":"Ana Lopez","until":"…"}
// HTTP 200 for both outcomes; controllers key off "allow". 401 if the key is wrong.
import { checkAccess, clubForAccessKey } from "../../../../lib/access";

export const dynamic = "force-dynamic";

async function handle(key: string, credential: string, door: string | null) {
  const clubId = key ? await clubForAccessKey(key) : null;
  if (!clubId) return Response.json({ allow: false, reason: "Bad API key" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!credential) return Response.json({ allow: false, reason: "No credential" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const r = await checkAccess(clubId, credential, door, "API");
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const body = (await req.json().catch(() => ({}))) as { credential?: string; uid?: string; card?: string; door?: string };
  return handle(key, String(body.credential ?? body.uid ?? body.card ?? ""), body.door ? String(body.door).slice(0, 60) : null);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key") || "";
  return handle(key, url.searchParams.get("credential") ?? url.searchParams.get("uid") ?? "", url.searchParams.get("door"));
}
