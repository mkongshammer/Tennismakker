import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { takeAiBudget } from "../../../lib/ai-budget";
import { allowMessage, answer, cleanMessages, logChat, SUPPORT_EMAIL } from "../../../lib/site-assistant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const h = await headers();
  // The first X-Forwarded-For entry can be set by the client; prefer the proxy's own header, else the last hop.
  const ip = h.get("cf-connecting-ip") || h.get("true-client-ip") || (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean).at(-1) || "unknown";
  if (!allowMessage(ip)) return NextResponse.json({ reply: `You've sent a lot of messages. Please e-mail ${SUPPORT_EMAIL} and we'll help you there.` }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "No question." }, { status: 400 });
  if (!(await takeAiBudget("chat").catch(() => false))) return NextResponse.json({ reply: `I can't answer more questions right now. Please e-mail ${SUPPORT_EMAIL} and we'll get back to you.` });
  try {
    const reply = await answer(messages);
    await logChat(String(body.conversationId ?? ""), messages, reply);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[assistant]", error instanceof Error ? error.message : error);
    return NextResponse.json({ reply: `Sorry, I can't answer right now. Please e-mail ${SUPPORT_EMAIL} and we'll get back to you.` });
  }
}
