import crypto from "node:crypto";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

function hash(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function page(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:620px;margin:64px auto;padding:0 20px;color:#17211b"><h1>${title}</h1><p>${body}</p><p>RacketBuddy</p></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return page("Invalid unsubscribe link", "This unsubscribe link is not valid.", 400);

  const row = await db.platformSetting.findUnique({ where: { key: `sales:unsubscribe:${token}` } }).catch(() => null);
  if (!row) return page("Already unsubscribed", "You will not receive further RacketBuddy sales outreach at this address.");

  try {
    const data = JSON.parse(row.value) as { email?: string; website?: string };
    const email = String(data.email ?? "").trim().toLowerCase();
    if (!email) return page("Invalid unsubscribe link", "This unsubscribe link is not valid.", 400);
    const key = `sales:suppressed:${hash(email)}`;
    await db.$transaction([
      db.platformSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify({ email, website: data.website ?? null, unsubscribedAt: new Date().toISOString() }) },
        update: { value: JSON.stringify({ email, website: data.website ?? null, unsubscribedAt: new Date().toISOString() }) },
      }),
      db.platformSetting.delete({ where: { key: row.key } }),
    ]);
    return page("You’re unsubscribed", "You will not receive further RacketBuddy sales outreach at this address.");
  } catch {
    return page("Invalid unsubscribe link", "This unsubscribe link is not valid.", 400);
  }
}
