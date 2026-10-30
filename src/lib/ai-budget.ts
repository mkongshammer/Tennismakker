// Hard daily caps on the public, paid AI features, so nobody can run up the
// OpenAI bill by flooding the website chat or support@ with messages from
// many addresses. Counted per UTC day in the database (shared by every
// server instance). When a cap is hit the feature falls back to "please
// e-mail us" / a plain hand-over, with no AI call.
import { db } from "./db";

export const AI_DAILY_LIMITS = {
  chat: 400,          // website chat messages
  email: 150,         // support mails + replies to sales mails, answered by AI
  escalationMail: 40, // hand-over mails to the owner (stops an inbox flood)
} as const;
export type AiFeature = keyof typeof AI_DAILY_LIMITS;

/** Takes one unit of today's budget. Returns false (and takes nothing) when the cap is reached. */
export async function takeAiBudget(feature: AiFeature, now = new Date()) {
  const key = `ai:budget:${feature}:${now.toISOString().slice(0, 10)}`;
  const row = await db.platformSetting.upsert({ where: { key }, create: { key, value: "0" }, update: {} });
  const used = Number(row.value) || 0;
  if (used >= AI_DAILY_LIMITS[feature]) return false;
  await db.platformSetting.update({ where: { key }, data: { value: String(used + 1) } });
  return true;
}

export async function aiBudgetUsed(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const rows = await db.platformSetting.findMany({ where: { key: { in: (Object.keys(AI_DAILY_LIMITS) as AiFeature[]).map((f) => `ai:budget:${f}:${day}`) } } });
  return Object.fromEntries((Object.keys(AI_DAILY_LIMITS) as AiFeature[]).map((f) => [f, Number(rows.find((r) => r.key === `ai:budget:${f}:${day}`)?.value ?? 0)])) as Record<AiFeature, number>;
}
