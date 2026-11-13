// One-off (13 Nov 2026): the club list got 0 new clubs on 11-12 Nov. Mails the
// owner (for Claude) what the harvest did, so the cause can be seen. Reads only.
import { db } from "./db";

const FLAG = "oneoff:harvest-diag:2026-11-13";

export async function harvestDiagOnce(now = new Date()) {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: now.toISOString() } });
  const { harvestStats, allLeads } = await import("./lead-harvest");
  const { aiBudgetUsed } = await import("./ai-budget");
  const { US_CITIES } = await import("./us-cities");
  const stats = await harvestStats(5, now).catch((e) => [{ key: "error", error: String(e) }]);
  const budget = await Promise.all([0, 1, 2].map(async (d) => [new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10), await aiBudgetUsed(new Date(now.getTime() - d * 86_400_000))]));
  const get = async (k: string) => (await db.platformSetting.findUnique({ where: { key: k } }).catch(() => null))?.value ?? null;
  const cityCur = Number(await get("sales:dircity:cursor") ?? 0);
  const [city, state] = US_CITIES[cityCur % US_CITIES.length];
  const cityCache = await get(`sales:dircity:${city}|${state}`);
  const dirCur = await get("sales:lead-harvest:dircursor");
  const lastRun = await get("sales:lead-harvest:last-run");
  const stateCaches = await db.platformSetting.findMany({ where: { key: { startsWith: "sales:dirg:" } }, select: { key: true, value: true } }).catch(() => []);
  const stateInfo = stateCaches.map((r) => { try { const q = JSON.parse(r.value); return `${r.key.slice(11)} ${String(q.at).slice(0, 10)} ${q.pos}/${q.venues?.length}`; } catch { return r.key; } });
  const leads = await allLeads("club").catch(() => []);
  const waiting = leads.filter((r) => !r.lead.pushedAt && !r.lead.exportedAt).length;
  const errs = await get("ops:error-log");
  const harvestErrs = errs ? (JSON.parse(errs) as Array<{ msg?: string; message?: string; at?: string }>).filter((e) => /lead|places|overpass|directory|harvest/i.test(JSON.stringify(e))).slice(-15) : [];
  const body = [
    `Statistik pr. dag:\n${JSON.stringify(stats, null, 1)}`,
    `Google-søgninger brugt (placesSearch m.m.):\n${budget.map(([d, b]) => `${d}: ${JSON.stringify(b)}`).join("\n")}`,
    `By-søgning: cursor ${cityCur} af ${US_CITIES.length}, nu ${city}, ${state}. Cache: ${cityCache ? cityCache.slice(0, 200) : "ingen"}`,
    `Stat-cursor: ${dirCur}. Sidste kørsel: ${lastRun}`,
    `Stater (${stateInfo.length}):\n${stateInfo.join("\n")}`,
    `Klubber i alt: ${leads.length}, venter på Instantly: ${waiting}`,
    `Fejl om søgning:\n${harvestErrs.map((e) => JSON.stringify(e).slice(0, 300)).join("\n") || "ingen"}`,
  ].join("\n\n");
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: diagnose af klubsøgning (til Claude)", body).catch(() => null);
}
