// One-off (17 Nov 2026): judge the "no online booking" group again, with
// what the sample taught us.
//
// Reading 25 of them showed three ways the first pass was wrong: a club whose
// booking sits behind a member login looked like a club with none (6 of 25),
// two systems were on the page but not in our table, and a couple of rows
// weren't clubs at all — a court resurfacing contractor, a condo association.
//
// So every club we called "none" is marked unjudged and looked at again by
// the scan, which now knows all three. Clubs that fall out of the group and
// have not been written to yet are taken out of the campaign; a club that has
// already had a mail stays, because removing it would lose the reply.
import { db } from "./db";

const FLAG = "oneoff:nosystem-recheck:2026-11-17";

export async function recheckNoSystemOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  try {
    const { allLeads } = await import("./lead-harvest");
    const { takesBookingsByHand } = await import("./club-system");
    const rows = await allLeads("club");
    let cleared = 0;
    for (const { key, lead } of rows) {
      const l = lead as { system?: string };
      if (!takesBookingsByHand(l.system)) continue;
      // Leave the answer blank so the scan judges it again from scratch.
      const { system: _s, systemName: _n, systemAt: _a, ...rest } = lead as Record<string, unknown>;
      await db.platformSetting.update({ where: { key }, data: { value: JSON.stringify(rest) } }).catch(() => {});
      cleared++;
    }
    await tellOwner(
      "RacketBuddy: gruppen uden online booking bliver vurderet forfra",
      [
        `${cleared} klubber er sat til at blive tjekket igen med tre nye ting i baghovedet:`,
        "· et medlemslogin tæller nu som 'har et system vi ikke kan se' — 6 ud af 25 i stikprøven havde et",
        "· RomeoSoft og CPS Golf er lagt ind i tabellen, de stod på siden uden at vi kendte dem",
        "· rækker der ikke er klubber (anlægsgartnere, ejerforeninger) ryger helt ud",
        "",
        "Scanningen tager 24 i minuttet, så gruppen er gennemgået igen i løbet af et par timer. Kampagnen kører videre imens på de klubber der allerede er lagt ind — det er dem i morgenmailen.",
      ].join("\n"),
    ).catch(() => null);
    return { cleared };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tellOwner("RacketBuddy: kunne ikke vurdere gruppen forfra", msg).catch(() => null);
    return { error: msg };
  }
}
