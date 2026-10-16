import { db } from "./db";
import { open, seal } from "./crypto-box";
import { regionalSharedConfig } from "./regional-config";

const CONFIG_KEY = "agent:config:v1";
const API_KEY = "agent:openai-key:v1";

export type AgentConfig = {
  enabled: boolean;
  fastModel: string;
  smartModel: string;
  salesEnabled: boolean;
  salesDailyLimit: number;
  salesMarket: "US";
  salesPostalAddress: string;
};

const DEFAULTS: AgentConfig = {
  enabled: true,
  fastModel: "gpt-6-luna",
  smartModel: "gpt-6.1-sol",
  salesEnabled: true,
  salesDailyLimit: 3,
  salesMarket: "US",
  salesPostalAddress: "",
};

function dailyLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULTS.salesDailyLimit;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

export async function getAgentConfig(): Promise<AgentConfig & { apiKey: string; apiKeySet: boolean }> {
  const [configRow, keyRow, shared] = await Promise.all([
    db.platformSetting.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: API_KEY } }).catch(() => null),
    regionalSharedConfig(),
  ]);

  let stored: Partial<AgentConfig> = {};
  try {
    stored = configRow?.value ? JSON.parse(configRow.value) : {};
  } catch {
    stored = {};
  }

  const databaseKey = keyRow?.value ? open(keyRow.value) : "";
  const environmentKey = process.env.OPENAI_API_KEY ?? "";
  const sharedAgents = shared?.agentConfig;
  const apiKey = databaseKey || environmentKey || sharedAgents?.apiKey || "";
  const hasLocalConfig = Boolean(configRow);

  return {
    enabled: hasLocalConfig ? stored.enabled === true : (sharedAgents?.enabled ?? DEFAULTS.enabled),
    fastModel: String(stored.fastModel || process.env.RACKETBUDDY_AGENT_FAST_MODEL || sharedAgents?.fastModel || DEFAULTS.fastModel),
    smartModel: String(stored.smartModel || process.env.RACKETBUDDY_AGENT_SMART_MODEL || sharedAgents?.smartModel || DEFAULTS.smartModel),
    salesEnabled: stored.salesEnabled === undefined ? DEFAULTS.salesEnabled : stored.salesEnabled === true,
    salesDailyLimit: dailyLimit(stored.salesDailyLimit),
    salesMarket: "US",
    salesPostalAddress: String(stored.salesPostalAddress ?? "").trim(),
    apiKey,
    apiKeySet: Boolean(apiKey),
  };
}

export async function saveAgentConfig(input: {
  enabled: boolean;
  fastModel: string;
  smartModel: string;
  salesEnabled?: boolean;
  salesDailyLimit?: number;
  salesMarket?: "US";
  salesPostalAddress?: string;
  apiKey?: string;
}) {
  const current = await getAgentConfig();
  const config: AgentConfig = {
    enabled: input.enabled,
    fastModel: input.fastModel.trim() || DEFAULTS.fastModel,
    smartModel: input.smartModel.trim() || DEFAULTS.smartModel,
    salesEnabled: input.salesEnabled ?? current.salesEnabled,
    salesDailyLimit: dailyLimit(input.salesDailyLimit ?? current.salesDailyLimit),
    salesMarket: "US",
    salesPostalAddress: String(input.salesPostalAddress ?? current.salesPostalAddress).trim(),
  };

  await db.platformSetting.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: JSON.stringify(config) },
    update: { value: JSON.stringify(config) },
  });

  const key = input.apiKey?.trim();
  if (key) {
    await db.platformSetting.upsert({
      where: { key: API_KEY },
      create: { key: API_KEY, value: seal(key) },
      update: { value: seal(key) },
    });
  }
}

export function maskAgentKey(value: string) {
  if (!value) return "";
  if (value.length < 12) return "••••••••";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
