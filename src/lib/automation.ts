// Hovedappens side af automatiseringen.
//
// Automatiseringen kører som en separat service (se automation/). Her ligger
// kun kaldene til den, og den ene regel der betyder noget:
//
//   Pengene trækkes først, når banen er verificeret reserveret i klubbens
//   eget system.
//
// Fejler automatiseringen, må gæsten ikke være blevet trukket. En betalt
// booking uden en bane er værre end en booking, der ikke blev til noget.

import { db } from "./db";
import { open, seal } from "./crypto-box";

const BASE = process.env.AUTOMATION_URL ?? "";
const SECRET = process.env.AUTOMATION_SECRET ?? "";

export function automationConfigured(): boolean {
  return Boolean(BASE && SECRET);
}

type Login = { baseUrl: string; username: string; password: string };

/** Klubbens adgang, dekrypteret. Null hvis klubben ikke har sat den op. */
export async function loginFor(clubId: string): Promise<Login | null> {
  const row = await db.clubSystemLogin.findUnique({ where: { clubId } });
  if (!row) return null;
  const password = open(row.password);
  if (!password) return null;
  return { baseUrl: row.baseUrl, username: row.username, password };
}

export async function saveLogin(
  clubId: string,
  baseUrl: string,
  username: string,
  password: string
): Promise<void> {
  const data = {
    baseUrl: baseUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    username: username.trim(),
    password: seal(password),
  };
  await db.clubSystemLogin.upsert({
    where: { clubId },
    create: { clubId, ...data },
    update: data,
  });
}

export async function removeLogin(clubId: string): Promise<void> {
  await db.clubSystemLogin.deleteMany({ where: { clubId } });
}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!automationConfigured()) {
    throw new Error("Automatiseringen er ikke sat op (AUTOMATION_URL/SECRET mangler).");
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-automation-secret": SECRET,
    },
    body: JSON.stringify(body),
    // En browser er langsom. Tredive sekunder er rundhåndet, men et hængende
    // kald må ikke holde en serverhandling åben i minutter.
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Automatiseringen svarede ${res.status}.`);
  return (await res.json()) as T;
}

export type InspectResult = {
  steps: { step: string; url?: string; title?: string; error?: string }[];
  loggedIn?: boolean;
  loginPageFields?: unknown[];
  afterLoginFields?: unknown[];
  bookingPageFields?: unknown[];
  bookingPageTables?: unknown[];
  screenshot?: string;
  error?: string;
};

/** Viser hvad automatiseringen ser. Det er sådan selektorerne findes. */
export function inspectSystem(login: Login, path?: string) {
  return call<InspectResult>("/inspect", { ...login, path });
}

export type BookResult = { verified: boolean; error?: string; screenshot?: string };

/**
 * Reserverer i klubbens eget system og verificerer.
 *
 * Skriver udfaldet på klubbens række, så både superadmin og selvtesten kan
 * se, hvornår det sidst virkede — en automatisering, ingen holder øje med,
 * er en automatisering, der er gået i stå uden at nogen ved det.
 */
export async function reserveInClubSystem(opts: {
  clubId: string;
  courtName: string;
  date: string;
  time: string;
}): Promise<BookResult> {
  const login = await loginFor(opts.clubId);
  if (!login) return { verified: false, error: "Klubben har ikke sat sin adgang op." };

  let result: BookResult;
  try {
    result = await call<BookResult>("/book", {
      ...login,
      court: opts.courtName,
      date: opts.date,
      time: opts.time,
    });
  } catch (err) {
    result = { verified: false, error: err instanceof Error ? err.message : String(err) };
  }

  await db.clubSystemLogin.updateMany({
    where: { clubId: opts.clubId },
    data: {
      lastTriedAt: new Date(),
      ...(result.verified
        ? { lastOkAt: new Date(), lastError: null }
        : { lastError: (result.error ?? "Ukendt fejl").slice(0, 500) }),
    },
  });

  return result;
}
