import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { allowMessage, answer, cleanMessages, logChat, SUPPORT_EMAIL } from "../../../lib/site-assistant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!allowMessage(ip)) return NextResponse.json({ reply: `You've sent a lot of messages. Please e-mail ${SUPPORT_EMAIL} and we'll help you there.` }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "No question." }, { status: 400 });
  try {
    const reply = await answer(messages);
    await logChat(String(body.conversationId ?? ""), messages, reply);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[assistant]", error instanceof Error ? error.message : error);
    return NextResponse.json({ reply: `Sorry, I can't answer right now. Please e-mail ${SUPPORT_EMAIL} and we'll get back to you.` });
  }
}
