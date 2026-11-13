// One-off (13 Nov 2026): the members paragraph added to the first club mail
// landed after the closing question ("Worth two minutes...?"). Moves it up to
// right after the price paragraph (the one ending "no contract."), so the mail
// still ends on the question.
import { db } from "./db";
import { MEMBERS_PARAGRAPH } from "./oneoff-member-copy";

const FLAG = "oneoff:member-copy-move:2026-11-13";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Pure: moves the members paragraph to just after the price paragraph. Unchanged if absent, null if it can't be placed. */
export function moveMembersParagraph(body: string) {
  const html = /<div|<p|<br/i.test(body);
  const para = html ? esc(MEMBERS_PARAGRAPH) : MEMBERS_PARAGRAPH;
  if (!body.includes(para)) return body;
  const block = html ? `<div>${para}</div><div><br /></div>` : `${para}\n\n`;
  if (!body.includes(block)) return null;
  const without = body.replace(block, "");
  const at = without.search(/no contract\./i);
  if (at < 0) return null;
  if (html) {
    const end = without.indexOf("</div>", at);
    if (end < 0) return null;
    return `${without.slice(0, end + 6)}<div><br /></div><div>${para}</div>${without.slice(end + 6)}`;
  }
  const end = without.indexOf("\n", at);
  if (end < 0) return null;
  return `${without.slice(0, end)}\n\n${para}${without.slice(end)}`;
}

const plain = (b: string) => b.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

export async function moveMemberCopyOnce() {
  const key = process.env.INSTANTLY_API_KEY, id = process.env.INSTANTLY_CAMPAIGN_ID;
  if (!key || !id) return;
  if (!(await db.platformSetting.findUnique({ where: { key: "oneoff:member-copy:2026-11-13" } }).catch(() => null))) return; // first change not done yet
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const api = (path: string, init: RequestInit = {}) => fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  const { tellOwner } = await import("./founding-offer");
  try {
    const res = await api(`/campaigns/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`campaign ${res.status}`);
    const c = (await res.json()) as { sequences?: Array<{ steps?: Array<{ variants?: Array<{ subject?: string; body?: string; [k: string]: unknown }>; [k: string]: unknown }>; [k: string]: unknown }> };
    const problems: string[] = [];
    const moved: string[] = [];
    let example = "";
    const sequences = (c.sequences ?? []).map((seq) => ({ ...seq, steps: (seq.steps ?? []).map((step, s) => ({ ...step, variants: (step.variants ?? []).map((v, n) => {
      if (s !== 0 || typeof v.body !== "string") return v;
      const b = moveMembersParagraph(v.body);
      if (b === null) { problems.push(`variant ${"ABCDE"[n]}`); return v; }
      if (b === v.body) return v;
      moved.push(`variant ${"ABCDE"[n]} (emne: ${plain(String(v.subject ?? ""))})`);
      if (!example) example = b;
      return { ...v, body: b };
    }) })) }));
    if (problems.length) throw new Error(`kunne ikke placere afsnittet i ${problems.join(", ")}`);
    if (!moved.length) throw new Error("fandt ikke afsnittet i første mail");
    const up = await api(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ sequences }) });
    if (!up.ok) throw new Error(`patch ${up.status} ${(await up.text()).slice(0, 200)}`);
    await tellOwner("RacketBuddy: afsnittet om medlemmerne er flyttet op", `Flyttet i første mail: ${moved.join(", ")}. Afsnittet står nu lige efter prisen, så mailen slutter med spørgsmålet.\n\n--- Sådan ser den ud ---\n${plain(example)}`);
  } catch (e) {
    console.error("[member-copy-move]", e);
    await tellOwner("RacketBuddy: afsnittet om medlemmerne blev IKKE flyttet", `${e instanceof Error ? e.message : String(e)}. Mailene er som før (afsnittet står efter spørgsmålet). Sig til Claude.`).catch(() => null);
  }
}
