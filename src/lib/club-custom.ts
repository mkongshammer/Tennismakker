import crypto from "crypto";
import { db } from "./db";

export const CLUB_MODULES = [
  { key: "WEBSITE", label: "Custom hjemmeside", description: "Klubbens hjemmeside, eget domæne og indhold styret fra RacketBuddy." },
  { key: "BOOKING", label: "Custom booking", description: "Bookingregler, medlemsadgang, gæster, faste tider og specialflows." },
  { key: "LIGHTING", label: "Lysstyring", description: "Tænd/sluk lys automatisk eller fra klubbens administration." },
  { key: "ACCESS", label: "Adgangskontrol", description: "Døre, koder, brikker og adgang knyttet til bookinger og medlemskab." },
  { key: "ACCOUNTING", label: "Regnskab", description: "Integration til klubbens regnskabsprogram og automatisk bogføring." },
  { key: "MEMBERSHIP", label: "Medlemmer & kontingent", description: "Kontingent, medlemstyper, rettigheder og automatiske betalinger." },
  { key: "PAYMENTS", label: "Betalinger", description: "Betaling, faktura, klippekort, refusioner og udbetalinger." },
  { key: "COMMUNICATION", label: "Kommunikation", description: "E-mails, nyheder, påmindelser og beskeder til medlemmer." },
  { key: "CUSTOM_API", label: "Custom integration/API", description: "Forbind RacketBuddy med andre systemer klubben allerede bruger." },
  { key: "CUSTOM", label: "Specialudvikling", description: "Klubspecifik funktionalitet bygget oven på RacketBuddy-platformen." },
] as const;

export type ClubModuleKey = (typeof CLUB_MODULES)[number]["key"];
export type ModuleStatus = "AVAILABLE" | "REQUESTED" | "BUILDING" | "ACTIVE" | "PAUSED";

export type ClubCustomConfig = {
  modules: Partial<Record<ClubModuleKey, ModuleStatus>>;
  notes?: string;
  updatedAt?: string;
};

export type ClubIntegration = {
  id: string;
  type: string;
  provider: string;
  endpoint?: string;
  accountRef?: string;
  status: "PLANNED" | "CONFIGURING" | "ACTIVE" | "ERROR";
  credentials?: Record<string, string>;
  updatedAt: string;
};

const configKey = (clubId: string) => `club-custom:${clubId}`;
const integrationsKey = (clubId: string) => `club-integrations:${clubId}`;

function keyMaterial() {
  return crypto.createHash("sha256").update(process.env.AUTH_SECRET ?? "racketbuddy-uden-noegle").digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

function decrypt(value: string) {
  if (!value.startsWith("v1.")) return value;
  try {
    const [, iv, tag, data] = value.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export async function getClubCustomConfig(clubId: string): Promise<ClubCustomConfig> {
  const row = await db.platformSetting.findUnique({ where: { key: configKey(clubId) } });
  if (!row) return { modules: {} };
  try {
    return JSON.parse(row.value) as ClubCustomConfig;
  } catch {
    return { modules: {} };
  }
}

export async function saveClubCustomConfig(clubId: string, config: ClubCustomConfig) {
  const value = JSON.stringify({ ...config, updatedAt: new Date().toISOString() });
  await db.platformSetting.upsert({
    where: { key: configKey(clubId) },
    create: { key: configKey(clubId), value },
    update: { value },
  });
}

export async function getClubIntegrations(clubId: string): Promise<ClubIntegration[]> {
  const row = await db.platformSetting.findUnique({ where: { key: integrationsKey(clubId) } });
  if (!row) return [];
  try {
    const raw = decrypt(row.value);
    return raw ? (JSON.parse(raw) as ClubIntegration[]) : [];
  } catch {
    return [];
  }
}

export async function saveClubIntegrations(clubId: string, integrations: ClubIntegration[]) {
  const value = encrypt(JSON.stringify(integrations));
  await db.platformSetting.upsert({
    where: { key: integrationsKey(clubId) },
    create: { key: integrationsKey(clubId), value },
    update: { value },
  });
}

export function moduleStatus(config: ClubCustomConfig, key: ClubModuleKey): ModuleStatus {
  return config.modules[key] ?? "AVAILABLE";
}
