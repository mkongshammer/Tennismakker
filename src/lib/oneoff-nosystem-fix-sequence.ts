// One-off (17 Nov 2026): writes the no-online-booking sequence back as it is
// written in code.
//
// Two things went wrong on the first day. The step delays were set as if
// `delay` meant "wait before this step" when Instantly means "wait after it",
// so 29 clubs got mail 1 and mail 2 the same day. And while fixing that by
// hand in Instantly's editor, two keystrokes landed in the body of mail 1 and
// took a sentence with them.
//
// Rather than repair the text in a browser, this writes the whole sequence
// back from NOSYSTEM_SEQUENCE, which was never touched. It leaves the
// campaign paused either way: resuming is a decision, not a side effect.
import { db } from "./db";

const FLAG = "oneoff:nosystem-fix-sequence:2026-11-17";
const html = (t: string) => t.split("\n").map((l) => `<div>${l ? l.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "<br>"}</div>`).join("");

export async function fixNoSystemSequenceOnce() {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) return { done: true };
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  try {
    const { noSystemCampaignId, NOSYSTEM_SEQUENCE } = await import("./instantly-nosystem-campaign");
    const id = await noSystemCampaignId();
    if (!id) throw Error("Kampagnen findes ikke endnu.");
    const sequences = [{ steps: NOSYSTEM_SEQUENCE.map((s) => ({ type: "email", delay: s.delay, variants: [{ subject: s.subject, body: html(s.body) }] })) }];
    const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ sequences }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) throw Error(`Instantly ${res.status}: ${text.slice(0, 300)}`);
    await tellOwner(
      "RacketBuddy: sekvensen uden online booking er skrevet rent igen",
      [
        "Mailteksten er sat tilbage som den står i koden, og ventetiden er nu 3 dage til mail 2 og 4 dage til mail 3.",
        "Kampagnen er stadig på pause — den starter ikke af sig selv.",
        "",
        "Mail 1:",
        "",
        NOSYSTEM_SEQUENCE[0].body,
      ].join("\n"),
    ).catch(() => null);
    return { fixed: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tellOwner("RacketBuddy: kunne ikke rette sekvensen uden online booking", msg).catch(() => null);
    return { error: msg };
  }
}
