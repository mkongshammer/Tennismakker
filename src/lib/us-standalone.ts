// Moving to a US-only setup: the US service used to borrow its Stripe, e-mail
// and AI settings from the EU service at runtime. This copies the values that
// still come from EU into the US database once (encrypted with the US key), so
// the US service keeps working when the EU service is switched off.
import { db } from "./db";
import { deploymentRegion } from "./region";

const FLAG = "region:us-standalone-copy:2026-11-05";

export async function copySharedConfigToUS(): Promise<{ copied: string[]; skipped?: string }> {
  if (deploymentRegion() !== "US") return { copied: [], skipped: "not-us" };
  const done = await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null);
  if (done) return { copied: [], skipped: "already-done" };

  const { regionalSharedConfig } = await import("./regional-config");
  const shared = await regionalSharedConfig();
  if (!shared) return { copied: [], skipped: "eu-unreachable" }; // try again next run

  const copied: string[] = [];
  const { getSettingsWithSource, saveSettings } = await import("./settings");
  const { settings, source } = await getSettingsWithSource();
  const patch: Record<string, string> = {};
  for (const key of ["paymentProvider", "stripeSecretKey", "emailApiKey", "emailFrom", "ordersEmail", "commissionPct"] as const) {
    if (source[key] === "regional" && settings[key] !== undefined && settings[key] !== "") patch[key] = String(settings[key]);
  }
  if (Object.keys(patch).length) {
    await saveSettings(patch as never);
    copied.push(...Object.keys(patch));
  }

  // AI: keep exactly what the US uses today, but stored locally.
  const { getAgentConfig, saveAgentConfig } = await import("./agent-config");
  const [configRow, keyRow] = await Promise.all([
    db.platformSetting.findUnique({ where: { key: "agent:config:v1" } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: "agent:openai-key:v1" } }).catch(() => null),
  ]);
  const agents = await getAgentConfig();
  const needKey = !keyRow && !process.env.OPENAI_API_KEY && Boolean(agents.apiKey);
  if (!configRow || needKey) {
    await saveAgentConfig({ ...agents, apiKey: needKey ? agents.apiKey : undefined });
    copied.push(...(!configRow ? ["agentConfig"] : []), ...(needKey ? ["agentApiKey"] : []));
  }

  // The club price book: the US form saves locally, but make sure a row exists.
  const { PRICE_BOOK_SETTING_KEY } = await import("./platform-pricing");
  const priceRow = await db.platformSetting.findUnique({ where: { key: PRICE_BOOK_SETTING_KEY } }).catch(() => null);
  if (!priceRow && shared.clubSignupPriceBook) {
    await db.platformSetting.create({ data: { key: PRICE_BOOK_SETTING_KEY, value: JSON.stringify(shared.clubSignupPriceBook) } });
    copied.push("clubSignupPriceBook");
  }

  await db.platformSetting.upsert({ where: { key: FLAG }, create: { key: FLAG, value: JSON.stringify({ at: new Date().toISOString(), copied }) }, update: {} });
  return { copied };
}

/** What still depends on EU, for the superadmin check. Never returns secret values. */
export async function usStandaloneStatus() {
  const { getSettingsWithSource } = await import("./settings");
  const { source } = await getSettingsWithSource();
  const { lastJobRuns } = await import("./self-cron");
  const [flag, configRow, keyRow] = await Promise.all([
    db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: "agent:config:v1" } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: "agent:openai-key:v1" } }).catch(() => null),
  ]);
  const fromEU = Object.entries(source).filter(([, s]) => s === "regional").map(([k]) => k);
  return {
    region: deploymentRegion(),
    copy: flag ? JSON.parse(flag.value) : null,
    settingSources: source,
    stillFromEU: fromEU,
    agentConfigLocal: Boolean(configRow),
    agentKeyLocal: Boolean(keyRow) || Boolean(process.env.OPENAI_API_KEY),
    selfCron: process.env.SELF_CRON !== "0",
    lastJobRuns: await lastJobRuns(),
  };
}
