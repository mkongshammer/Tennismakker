// One-off (13 Nov 2026): the owner wants the club mails to say more about what
// the club and its members get for $50 a month: members find other players
// and chat to set up a game, find and book coaches, and so on.
//  - Step 1, variants A and B (admin-focused): one paragraph about members.
//    Variant C already lists everything and is left alone.
//  - Step 2 (0 replies from 175 sent): rewritten around what members get.
//  - Step 3 is left alone (best reply rate).
// The old sequences are saved first, so the change can be rolled back.
import { db } from "./db";

const FLAG = "oneoff:member-copy:2026-11-13";
const BACKUP = "sales:campaign-copy-backup:2026-11-13";

export const MEMBERS_PARAGRAPH = "Your members get a lot out of it too. In the RacketBuddy app they book courts in a few taps, find other players at their level and chat to set up a game, book lessons with your coaches, and sign up for clinics, leagues and tournaments. All of that is included in the $50 a month, with no per-member fees.";

export const STEP2_LINES = [
  "One part I didn't mention: what your members get.",
  "With RacketBuddy every member has the app on their phone. They can:",
  "- book a court in a few taps, and join the waitlist when it's full",
  "- find other players at their level who want to play, and chat with them to set up a game",
  "- book a lesson with one of your coaches",
  "- sign up for clinics, leagues and tournaments, with draws, schedules and results in the app",
  "Members who can always find someone to play with book more courts, also at the quiet hours.",
  "All of it is included in the same flat $50 a month as the booking and admin side for you. No per-member fees and no commission on bookings.",
  "The free check at racketbuddy.app/switch takes about two minutes: upload your member export and you'll see exactly what moves across. Or just reply here with a question.",
];

const ANCHOR = "I also put together a private preview";
const isHtml = (b: string) => /<div|<p|<br/i.test(b);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Pure: puts the members paragraph just before the preview sentence. Null if the anchor is missing. */
export function addMembersParagraph(body: string) {
  if (body.includes("chat to set up a game")) return body;
  const i = body.indexOf(ANCHOR);
  if (i < 0) return null;
  if (isHtml(body)) {
    const start = body.lastIndexOf("<div", i);
    if (start < 0) return null;
    return `${body.slice(0, start)}<div>${esc(MEMBERS_PARAGRAPH)}</div><div><br /></div>${body.slice(start)}`;
  }
  const start = body.lastIndexOf("\n", i) + 1;
  return `${body.slice(0, start)}${MEMBERS_PARAGRAPH}\n\n${body.slice(start)}`;
}

/** Pure: keeps the greeting and everything from the preview sentence on, replaces the middle. Null if anchors are missing. */
export function rewriteStep2(body: string) {
  if (body.includes("what your members get")) return body;
  const i = body.indexOf(ANCHOR);
  const hi = body.indexOf("Hi ");
  if (i < 0 || hi < 0 || hi > i) return null;
  if (isHtml(body)) {
    const greetEnd = body.indexOf("</div>", hi);
    const tailStart = body.lastIndexOf("<div", i);
    if (greetEnd < 0 || tailStart < 0 || greetEnd > tailStart) return null;
    const blocks: string[] = [];
    STEP2_LINES.forEach((l, n) => {
      blocks.push(`<div>${esc(l)}</div>`);
      const nextIsBullet = STEP2_LINES[n + 1]?.startsWith("- ");
      if (!(l.startsWith("- ") && nextIsBullet) && !(n === 1)) blocks.push("<div><br /></div>");
    });
    return `${body.slice(0, greetEnd + 6)}<div><br /></div>${blocks.join("")}${body.slice(tailStart)}`;
  }
  const greetEnd = body.indexOf("\n", hi);
  const tailStart = body.lastIndexOf("\n", i) + 1;
  if (greetEnd < 0 || greetEnd > tailStart) return null;
  const text = STEP2_LINES.map((l, n) => (l.startsWith("- ") && STEP2_LINES[n + 1]?.startsWith("- ")) || n === 1 ? `${l}\n` : `${l}\n\n`).join("");
  return `${body.slice(0, greetEnd)}\n\n${text}${body.slice(tailStart)}`;
}

const plain = (b: string) => b.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

export async function updateMemberCopyOnce() {
  const key = process.env.INSTANTLY_API_KEY, id = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !id) return;
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const api = (path: string, init: RequestInit = {}) => fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  const { tellOwner } = await import("./founding-offer");
  try {
    const res = await api(`/campaigns/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`campaign ${res.status}`);
    const c = (await res.json()) as { sequences?: Array<{ steps?: Array<{ variants?: Array<{ body?: string; [k: string]: unknown }>; [k: string]: unknown }>; [k: string]: unknown }> };
    await db.platformSetting.upsert({ where: { key: BACKUP }, create: { key: BACKUP, value: JSON.stringify(c.sequences ?? []) }, update: { value: JSON.stringify(c.sequences ?? []) } });
    const problems: string[] = [];
    let step1 = "", step2 = "";
    const sequences = (c.sequences ?? []).map((seq) => ({ ...seq, steps: (seq.steps ?? []).map((step, s) => ({ ...step, variants: (step.variants ?? []).map((v, n) => {
      if (typeof v.body !== "string") return v;
      if (s === 0 && n < 2) { const b = addMembersParagraph(v.body); if (!b) { problems.push(`trin 1 variant ${"ABC"[n]}`); return v; } if (!step1) step1 = b; return { ...v, body: b }; }
      if (s === 1) { const b = rewriteStep2(v.body); if (!b) { problems.push("trin 2"); return v; } step2 = b; return { ...v, body: b }; }
      return v;
    }) })) }));
    if (problems.length) throw new Error(`fandt ikke ankerteksten i ${problems.join(", ")}`);
    const up = await api(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ sequences }) });
    if (!up.ok) throw new Error(`patch ${up.status} ${(await up.text()).slice(0, 200)}`);
    await tellOwner("RacketBuddy: salgsmailene fortæller nu mere om, hvad medlemmerne får",
      `Opdateret i klubkampagnen:\n- Første mail (variant A og B): nyt afsnit om medlemmerne.\n- Anden mail: skrevet om, så den handler om, hvad medlemmerne får.\nVariant C og tredje mail er uændrede. Den gamle tekst er gemt, så den kan sættes tilbage.\n\n--- Første mail, variant A ---\n${plain(step1)}\n\n--- Anden mail ---\n${plain(step2)}`);
  } catch (e) {
    console.error("[member-copy]", e);
    await tellOwner("RacketBuddy: salgsmailene blev IKKE ændret", `${e instanceof Error ? e.message : String(e)}. Intet er ændret. Sig til Claude.`).catch(() => null);
  }
}
