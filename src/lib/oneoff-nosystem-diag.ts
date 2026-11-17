// One-off (17 Nov 2026): why hasn't a single club landed in the new
// no-online-booking campaign?
//
// Read-only. It reports what the scan has found, how many clubs are waiting,
// what the two campaigns would accept right now, and when the jobs last ran —
// enough to tell a scan that isn't running from a scan that simply hasn't
// found any club without online booking yet.
import { db } from "./db";

const FLAG = "oneoff:nosystem-diag:2026-11-17b";

export async function nosystemDiagOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  const lines: string[] = [];
  const say = (s: string) => lines.push(s);
  try {
    const { systemBreakdown, scanOrder, SCAN_BATCH } = await import("./club-system-scan");
    const { allLeads } = await import("./lead-harvest");
    const { takesBookingsByHand } = await import("./club-system");
    const { noSystemCampaignId } = await import("./instantly-nosystem-campaign");
    const { clubsToAdd, NOSYSTEM_BUFFER } = await import("./campaign-queue");

    const b = await systemBreakdown();
    say(`Klubber på listen: ${b.total}`);
    say(`Tjekket: ${b.checked} · ikke tjekket endnu: ${b.notChecked} · kunne ikke hentes: ${b.unknown}`);
    say(`Uden online booking: ${b.byHand} (heraf ${b.byHandWaiting} ikke skrevet til endnu)`);
    say(`Fordeling: ${b.systems.map(([k, n]) => `${k} ${n}`).join(" · ")}`);

    const stats = await db.platformSetting.findUnique({ where: { key: "sales:club-system:stats" } }).catch(() => null);
    say(`Scanner-tæller: ${stats?.value ?? "ingen — scanningen har aldrig gennemført en runde"}`);

    const rows = await allLeads("club");
    const next = scanOrder(rows as never, SCAN_BATCH);
    say(`Næste batch ville tjekke ${next.length} klubber`);
    const waiting = rows.filter((r) => !r.lead.pushedAt && !r.lead.exportedAt);
    const waitingByHand = waiting.filter((r) => takesBookingsByHand((r.lead as { system?: string }).system));
    const waitingScanned = waiting.filter((r) => (r.lead as { system?: string }).system);
    say(`Venter på at blive skrevet til: ${waiting.length} · heraf tjekket ${waitingScanned.length} · heraf uden booking ${waitingByHand.length}`);

    const nosystemId = await noSystemCampaignId().catch((e) => `FEJL: ${e}`);
    say(`Kampagne-id (uden booking): ${nosystemId ?? "IKKE SAT — derfor ryger ingen klubber derind"}`);
    const main = process.env.INSTANTLY_CAMPAIGN_ID;
    if (main) say(`Hovedkampagnen har plads til: ${await clubsToAdd(main).catch((e) => `fejl: ${e}`)}`);
    if (typeof nosystemId === "string" && nosystemId.length > 20) say(`Ny kampagne har plads til: ${await clubsToAdd(nosystemId, NOSYSTEM_BUFFER).catch((e) => `fejl: ${e}`)}`);

    const when = await db.platformSetting.findMany({ where: { key: { in: ["cron:last-run:club-control", "cron:last-run:sync", "sales:lead-harvest:last-run"] } } });
    for (const w of when) say(`${w.key}: ${w.value}`);
    const errs = await db.platformSetting.findUnique({ where: { key: "ops:error-log" } }).catch(() => null);
    if (errs) say(`Seneste serverfejl: ${errs.value.slice(0, 1200)}`);
  } catch (e) {
    say(`Diagnosen fejlede: ${e instanceof Error ? `${e.message}\n${e.stack}` : String(e)}`);
  }
  await tellOwner("RacketBuddy: diagnose — kampagnen uden online booking", lines.join("\n")).catch(() => null);
  console.log("[nosystem-diag]", lines.join(" | "));
  return { sent: true, lines: lines.length };
}
