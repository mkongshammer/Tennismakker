// One-off (18 Nov 2026): take the clubs that no longer belong out of the
// no-online-booking campaign.
//
// Last night every club in that group was judged again, now that a member
// login counts as "a system we cannot see" and a resurfacing contractor is
// not a club. But that only fixed our own list: the clubs were already
// loaded into Instantly, so without this they get the wrong first mail today.
//
// Two rules, and they are both about not doing damage:
//  - A club that has already had a mail stays. Removing it would lose the
//    reply and the unsubscribe, and the mail has been sent either way.
//  - The leads to remove are named one by one. Instantly's delete takes a
//    list of ids, and an empty list there means "the whole campaign", so the
//    call is never made without ids.
//
// A club taken out here is handed back to the ordinary club campaign, which
// is the one written for clubs that already have a system.
import { db } from "./db";

const FLAG = "oneoff:nosystem-prune:2026-11-18";
const api = "https://api.instantly.ai/api/v2";

type InstantlyLead = { id: string; email: string; timestamp_last_contact?: string | null; email_open_count?: number; email_reply_count?: number; email_click_count?: number };

/** Pure: has Instantly ever sent to this lead? Anything uncertain counts as yes. */
export function everContacted(l: InstantlyLead) {
  if (l.timestamp_last_contact) return true;
  if ((l.email_open_count ?? 0) > 0 || (l.email_reply_count ?? 0) > 0 || (l.email_click_count ?? 0) > 0) return true;
  return false;
}

export async function pruneNoSystemCampaignOnce() {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) return { done: true };
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  try {
    const { noSystemCampaignId } = await import("./instantly-nosystem-campaign");
    const { takesBookingsByHand } = await import("./club-system");
    const { allLeads } = await import("./lead-harvest");
    const campaign = await noSystemCampaignId();
    if (!campaign) throw Error("Kampagnen findes ikke.");

    // Our own verdict, by e-mail.
    const ours = new Map<string, { key: string; lead: Record<string, unknown>; byHand: boolean; judged: boolean }>();
    for (const { key: rowKey, lead } of await allLeads("club")) {
      const l = lead as { email: string; system?: string };
      ours.set(l.email.toLowerCase(), { key: rowKey, lead: lead as Record<string, unknown>, byHand: takesBookingsByHand(l.system), judged: Boolean(l.system) });
    }

    // Everyone Instantly has in that campaign.
    const inCampaign: InstantlyLead[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 60; page++) {
      const res = await fetch(`${api}/leads/list`, { method: "POST", headers: h, body: JSON.stringify({ campaign, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }), signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw Error(`Instantly ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = await res.json() as { items?: InstantlyLead[]; next_starting_after?: string };
      const items = body.items ?? [];
      inCampaign.push(...items);
      cursor = body.next_starting_after;
      if (!cursor || !items.length) break;
    }

    const contacted = inCampaign.filter(everContacted);
    const drop = inCampaign.filter((l) => {
      if (everContacted(l)) return false;              // already written to: leave alone
      const mine = ours.get((l.email ?? "").toLowerCase());
      if (!mine || !mine.judged) return false;          // not judged yet: leave alone
      return !mine.byHand;                              // judged, and no longer in the group
    });

    // A guard against a misread field emptying the campaign: if nearly
    // everything looks droppable, something is wrong with the reading, not
    // with the clubs.
    if (drop.length > inCampaign.length * 0.8) throw Error(`Stopper: ${drop.length} af ${inCampaign.length} så ud til at skulle fjernes. Det er for mange til at være rigtigt.`);

    let removed = 0;
    for (let i = 0; i < drop.length; i += 100) {
      const ids = drop.slice(i, i + 100).map((l) => l.id).filter(Boolean);
      if (!ids.length) continue; // an empty list would mean the whole campaign
      const res = await fetch(`${api}/leads`, { method: "DELETE", headers: h, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw Error(`Sletning afvist ${res.status}: ${(await res.text()).slice(0, 200)}`);
      removed += ids.length;
      await new Promise((r) => setTimeout(r, 400));
    }

    // Hand them back to the ordinary campaign, which is written for clubs
    // that already have a system.
    let handedBack = 0;
    for (const l of drop) {
      const mine = ours.get((l.email ?? "").toLowerCase());
      if (!mine) continue;
      const { pushedAt: _p, ...rest } = mine.lead;
      await db.platformSetting.update({ where: { key: mine.key }, data: { value: JSON.stringify(rest) } }).catch(() => {});
      handedBack++;
    }

    await tellOwner(
      "RacketBuddy: kampagnen uden online booking er ryddet",
      [
        `I kampagnen lå ${inCampaign.length} klubber. ${contacted.length} af dem har allerede fået en mail og er rørt urørt.`,
        `${removed} er taget ud, fordi nattens gennemgang flyttede dem ud af gruppen — medlemslogin, et system vi nu genkender, eller slet ikke en klub.`,
        `${handedBack} af dem er givet tilbage til den almindelige klubkampagne, som er skrevet til klubber der allerede har et system.`,
        "",
        `Tilbage i kampagnen: ${inCampaign.length - removed} klubber. Dagens mails går til dem.`,
      ].join("\n"),
    ).catch(() => null);
    return { inCampaign: inCampaign.length, contacted: contacted.length, removed, handedBack };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tellOwner("RacketBuddy: kunne ikke rydde kampagnen uden online booking", msg).catch(() => null);
    return { error: msg };
  }
}
