// Platformens egen opsætning — redigerbar fra /superadmin/opsaetning.
//
// Hvorfor en tabel og ikke bare miljøvariabler: at rette en nøgle på Render
// kræver, at man logger ind der og venter på en genstart. Det er et dårligt
// sted at have sin provision liggende, når man opdager en fejl klokken ni om
// søndagen. Værdierne bor derfor i databasen, og miljøvariablerne bruges som
// reserve — en tom tabel opfører sig præcis som før, så intet går i stykker
// ved første udrulning.
//
// Hemmeligheder (Stripe-nøgler, mailnøgle) krypteres, inden de gemmes.
// Krypteringsnøglen udledes af AUTH_SECRET, som bliver i miljøet. Den ene
// variabel — plus DATABASE_URL — kan i sagens natur ikke flyttes ind i den
// database, de selv låser op. Alt andet kan.

import crypto from "crypto";
import { db } from "./db";

export type Settings = {
  paymentProvider: "stripe" | "mock";
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  commissionPct: number;
  appUrl: string;
  emailApiKey: string;
  emailFrom: string;
  ordersEmail: string;
};

/**
 * Hvert felt kobles til sin miljøvariabel. Rækkefølgen her er også den,
 * opsætningssiden viser felterne i.
 */
export const FIELDS = {
  paymentProvider: { env: "PAYMENT_PROVIDER", secret: false, fallback: "mock" },
  stripeSecretKey: { env: "STRIPE_SECRET_KEY", secret: true, fallback: "" },
  stripeWebhookSecret: { env: "STRIPE_WEBHOOK_SECRET", secret: true, fallback: "" },
  commissionPct: { env: "COMMISSION_PCT", secret: false, fallback: "0.10" },
  appUrl: { env: "APP_URL", secret: false, fallback: "https://racketbuddy.app" },
  emailApiKey: { env: "EMAIL_API_KEY", secret: true, fallback: "" },
  emailFrom: { env: "EMAIL_FROM", secret: false, fallback: "RacketBuddy <ikke-svar@racketbuddy.app>" },
  ordersEmail: { env: "ORDERS_EMAIL", secret: false, fallback: "" },
} as const;

export type SettingKey = keyof typeof FIELDS;
export const SETTING_KEYS = Object.keys(FIELDS) as SettingKey[];

/** Navne, der kan stå i en sætning til et menneske. */
export const LABELS: Record<SettingKey, string> = {
  paymentProvider: "betalingstilstand",
  stripeSecretKey: "Stripes hemmelige nøgle",
  stripeWebhookSecret: "webhook-hemmeligheden",
  commissionPct: "vores andel",
  appUrl: "appens adresse",
  emailApiKey: "nøglen til mailudbyderen",
  emailFrom: "afsenderen",
  ordersEmail: "modtageradressen",
};

/** Hvor en værdi i sidste ende kom fra — vises på opsætningssiden. */
export type Source = "database" | "miljø" | "standard";

// ---------------------------------------------------------------------------
// Kryptering af hemmeligheder
// ---------------------------------------------------------------------------

function cipherKey(): Buffer {
  // AUTH_SECRET er allerede den nøgle, hele login-systemet står og falder med.
  // Er den kompromitteret, er Stripe-nøglen det mindste af problemerne.
  return crypto
    .createHash("sha256")
    .update(process.env.AUTH_SECRET ?? "racketbuddy-uden-noegle")
    .digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    c.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

function decrypt(stored: string): string {
  if (!stored.startsWith("v1.")) return stored; // gemt før krypteringen kom til
  const [, iv, tag, data] = stored.split(".");
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Forkert AUTH_SECRET. Bedre at opføre sig som "ikke sat" end at
    // sende en ulæselig nøgle videre til Stripe.
    console.error("Kunne ikke dekryptere en indstilling — er AUTH_SECRET skiftet?");
    return "";
  }
}

// ---------------------------------------------------------------------------
// Opslag
// ---------------------------------------------------------------------------

function resolve(stored: Map<string, string>) {
  const raw = {} as Record<SettingKey, string>;
  const source = {} as Record<SettingKey, Source>;

  for (const key of SETTING_KEYS) {
    const field = FIELDS[key];
    const fromDb = stored.get(key);
    if (fromDb !== undefined && fromDb !== "") {
      raw[key] = field.secret ? decrypt(fromDb) : fromDb;
      source[key] = "database";
      if (raw[key] !== "") continue;
    }
    const fromEnv = process.env[field.env];
    if (fromEnv) {
      raw[key] = fromEnv;
      source[key] = "miljø";
      continue;
    }
    raw[key] = field.fallback;
    source[key] = "standard";
  }

  const pct = Number(raw.commissionPct);
  const settings: Settings = {
    paymentProvider: raw.paymentProvider === "stripe" ? "stripe" : "mock",
    stripeSecretKey: raw.stripeSecretKey,
    stripeWebhookSecret: raw.stripeWebhookSecret,
    // Et fejlindtastet felt må aldrig kunne sætte provisionen til NaN og
    // dermed vælte enhver betaling. Uden for 0-50% falder vi tilbage til 10.
    commissionPct: Number.isFinite(pct) && pct >= 0 && pct <= 0.5 ? pct : 0.1,
    appUrl: raw.appUrl.replace(/\/+$/, ""),
    emailApiKey: raw.emailApiKey,
    emailFrom: raw.emailFrom,
    ordersEmail: raw.ordersEmail,
  };

  return { settings, source };
}

let cache: { at: number; settings: Settings; source: Record<SettingKey, Source> } | null = null;
const TTL_MS = 10_000;

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;

  let rows: { key: string; value: string }[] = [];
  try {
    rows = await db.platformSetting.findMany({ select: { key: true, value: true } });
  } catch {
    // Tabellen findes ikke endnu (før første `prisma db push`). Kør videre
    // på miljøvariablerne — appen skal ikke gå ned af en manglende tabel.
  }

  const { settings, source } = resolve(new Map(rows.map((r) => [r.key, r.value])));
  cache = { at: Date.now(), settings, source };
  return cache;
}

/** Den gældende opsætning. Bruges alle steder i stedet for process.env. */
export async function getSettings(): Promise<Settings> {
  return (await load()).settings;
}

/** Opsætningen plus hvor hver værdi kom fra. Kun til opsætningssiden. */
export async function getSettingsWithSource() {
  const { settings, source } = await load();
  return { settings, source };
}

/**
 * Sidst indlæste opsætning, uden at vente på databasen.
 *
 * Findes udelukkende, fordi e-mailskabelonerne bygger links synkront, mens
 * de sammensættes. Er cachen kold, svarer den præcis som miljøvariablerne —
 * altså som appen gjorde, før denne fil fandtes.
 */
export function settingsSnapshot(): Settings {
  return cache?.settings ?? resolve(new Map()).settings;
}

/** Henter opsætningen ind i cachen, så snapshottet er varmt bagefter. */
export async function ensureSettings(): Promise<void> {
  await load();
}

// ---------------------------------------------------------------------------
// Skrivning
// ---------------------------------------------------------------------------

/**
 * Gemmer ændrede felter. En værdi på `null` sletter rækken, så feltet falder
 * tilbage til miljøvariablen — det er sådan man fortryder en indtastning
 * uden at skulle kende den oprindelige værdi.
 */
export async function saveSettings(patch: Partial<Record<SettingKey, string | null>>) {
  for (const [key, value] of Object.entries(patch) as [SettingKey, string | null][]) {
    if (value === null) {
      await db.platformSetting.deleteMany({ where: { key } });
      continue;
    }
    const stored = FIELDS[key].secret ? encrypt(value) : value;
    await db.platformSetting.upsert({
      where: { key },
      create: { key, value: stored },
      update: { value: stored },
    });
  }
  cache = null;
}

/** Er tabellen overhovedet lagt ind i databasen endnu? */
export async function settingsTableReady(): Promise<boolean> {
  try {
    await db.platformSetting.count();
    return true;
  } catch {
    return false;
  }
}

/** "sk_live_…4821" — nok til at genkende en nøgle, ikke nok til at bruge den. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
