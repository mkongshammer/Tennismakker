// Resend's "email.received" webhook: mail to support@racketbuddy.app,
// forwarded from Gmail to RacketBuddy's Resend inbound address. The webhook
// only carries an id; the mail itself is fetched from Resend with our own key,
// so a forged call with a made-up id does nothing. With RESEND_WEBHOOK_SECRET
// set, the Svix signature is checked too.
import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { fetchReceived, handleSupportMail } from "../../../../lib/email-assistant";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

function signatureOk(secret: string, id: string, timestamp: string, body: string, header: string) {
  if (!id || !timestamp || !header) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 600) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return header.split(" ").some((part) => {
    const sig = Buffer.from(part.split(",")[1] ?? "", "base64");
    return sig.length === expected.length && crypto.timingSafeEqual(sig, expected);
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret && !signatureOk(secret, request.headers.get("svix-id") ?? "", request.headers.get("svix-timestamp") ?? "", body, request.headers.get("svix-signature") ?? "")) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let event: { type?: string; data?: { email_id?: string } };
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: true });
  const emailId = event.data.email_id;
  // Answer fast; the AI runs after the response.
  after(async () => {
    const mail = await fetchReceived(emailId);
    if ("error" in mail) {
      console.error("[support-mail] could not fetch", emailId, mail.error);
      await db.platformSetting.upsert({ where: { key: "mail:inbound-error" }, create: { key: "mail:inbound-error", value: JSON.stringify({ at: new Date().toISOString(), error: mail.error }) }, update: { value: JSON.stringify({ at: new Date().toISOString(), error: mail.error }) } }).catch(() => null);
      return;
    }
    await handleSupportMail(mail).catch((e) => console.error("[support-mail] failed", e));
  });
  return NextResponse.json({ ok: true });
}
