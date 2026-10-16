import { db } from "./db";
import { open, seal } from "./crypto-box";

const CONFIG_KEY = "agent:config:v1";
const API_KEY = "agent:openai-key:v1";

export type AgentConfig = {
  enabled: boolean;
  fastModel: string;
  smartModel: string;
};

const DEFAULTS: AgentConfig = {
  enabled: false,
  fastModel: "gpt-6-luna",
  smartModel: "gpt-6.1-sol",
};

export async function getAgentConfig(): Promise<AgentConfig & { apiKey: string; apiKeySet: boolean }> {
  const [configRow, keyRow] = await Promise.all([
    db.platformSetting.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: API_KEY } }).catch(() => null),
  ]);

  let stored: Partial<AgentConfig> = {};
  try {
    stored = configRow?.value ? JSON.parse(configRow.value) : {};
  } catch {
    stored = {};
  }

  const databaseKey = keyRow?.value ? open(keyRow.value) : "";
  const environmentKey = process.env.OPENAI_API_KEY ?? "";
  const apiKey = databaseKey || environmentKey;

  return {
    enabled: stored.enabled === true,
    fastModel: String(stored.fastModel || process.env.RACKETBUDDY_AGENT_FAST_MODEL || DEFAULTS.fastModel),
    smartModel: String(stored.smartModel || process.env.RACKETBUDDY_AGENT_SMART_MODEL || DEFAULTS.smartModel),
    apiKey,
    apiKeySet: Boolean(apiKey),
  };
}

export async function saveAgentConfig(input: {
  enabled: boolean;
  fastModel: string;
  smartModel: string;
  apiKey?: string;
}) {
  const config: AgentConfig = {
    enabled: input.enabled,
    fastModel: input.fastModel.trim() || DEFAULTS.fastModel,
    smartModel: input.smartModel.trim() || DEFAULTS.smartModel,
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
