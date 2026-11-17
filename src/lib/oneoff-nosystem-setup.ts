// One-off (17 Nov 2026): sets up the second club campaign — the clubs that
// have no online booking — and tells the owner it is ready.
//
// It is created paused on purpose. Nothing is sent until the owner starts it,
// so he sees the new first e-mail before a single club does.
import { db } from "./db";

const FLAG = "oneoff:nosystem-setup:2026-11-17";

export async function setupNoSystemCampaignOnce() {
  if (!process.env.INSTANTLY_API_KEY || !process.env.INSTANTLY_CAMPAIGN_ID) return { done: true };
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  try {
    const { createNoSystemCampaign, NOSYSTEM_SEQUENCE, NOSYSTEM_CAMPAIGN_NAME } = await import("./instantly-nosystem-campaign");
    const { id, created } = await createNoSystemCampaign();
    const { systemBreakdown } = await import("./club-system-scan");
    const b = await systemBreakdown().catch(() => null);
    await tellOwner(
      "RacketBuddy: ny kampagne til klubber uden online booking er klar (på pause)",
      [
        `Kampagnen "${NOSYSTEM_CAMPAIGN_NAME}" er ${created ? "oprettet" : "allerede oprettet"} i Instantly (id ${id}).`,
        "Den står på PAUSE. Der bliver ikke sendt én mail, før du starter den selv i Instantly.",
        "",
        b ? `Status på gennemgangen af klubbernes hjemmesider: ${b.checked} af ${b.total} er tjekket, ${b.byHand} har ingen online booking (${b.byHandWaiting} af dem har ikke fået en mail endnu).` : "",
        "",
        "Mail 1 ser sådan ud:",
        "",
        NOSYSTEM_SEQUENCE[0].body,
      ].filter(Boolean).join("\n"),
    ).catch(() => null);
    return { id, created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tellOwner("RacketBuddy: kunne ikke oprette kampagnen til klubber uden online booking", msg).catch(() => null);
    return { error: msg };
  }
}
