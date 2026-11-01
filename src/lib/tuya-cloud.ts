// Tuya Cloud (Smart Life / Tuya Smart and the many brands built on it).
// The club creates a free cloud project on iot.tuya.com, links its Smart Life
// app account to it, and gives us the project's Access ID and Access Secret.
// We read relay states and switch them with the official OpenAPI.
import crypto from "node:crypto";

export const TUYA_REGIONS: Record<string, string> = {
  us: "https://openapi.tuyaus.com",
  "us-east": "https://openapi-ueaz.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  "eu-west": "https://openapi-weaz.tuyaeu.com",
  in: "https://openapi.tuyain.com",
  cn: "https://openapi.tuyacn.com",
};

export type TuyaCredentials = { endpoint: string; accessId: string; secret: string };
export type TuyaDeviceState = { id: string; online: boolean; name?: string; product?: string; codes: Record<string, unknown> };

export function tuyaEndpoint(region: string) {
  const url = TUYA_REGIONS[region.trim().toLowerCase()];
  if (!url) throw new Error("Choose the Tuya data center your project uses (for the US: Western America).");
  return url;
}
export function normaliseTuyaDeviceId(input: string) {
  const id = input.trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new Error("A Tuya Device ID looks like 'bf1234abcd5678efgh' (letters and digits).");
  return id;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const hmac = (s: string, key: string) => crypto.createHmac("sha256", key).update(s).digest("hex").toUpperCase();

/** Tuya's request signature (HMAC-SHA256 over client id, token, time, nonce and the canonical request). */
export function tuyaSign(c: TuyaCredentials, method: string, pathWithQuery: string, body: string, t: string, nonce: string, token = "") {
  const [path, query = ""] = pathWithQuery.split("?");
  const sortedQuery = query ? query.split("&").sort().join("&") : "";
  const url = sortedQuery ? `${path}?${sortedQuery}` : path;
  const stringToSign = [method.toUpperCase(), sha256(body), "", url].join("\n");
  return hmac(c.accessId + token + t + nonce + stringToSign, c.secret);
}

const tokens = new Map<string, { token: string; expires: number }>();

async function call<T>(c: TuyaCredentials, method: "GET" | "POST", pathWithQuery: string, bodyObj?: unknown, auth = true): Promise<T> {
  const body = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
  const t = String(Date.now());
  const nonce = crypto.randomUUID();
  const token = auth ? await accessToken(c) : "";
  const headers: Record<string, string> = { client_id: c.accessId, t, nonce, sign_method: "HMAC-SHA256", sign: tuyaSign(c, method, pathWithQuery, body, t, nonce, token) };
  if (token) headers.access_token = token;
  if (body) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${c.endpoint}${pathWithQuery}`, { method, headers, body: body || undefined, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch { throw new Error("Couldn't reach Tuya Cloud."); }
  const data = await res.json().catch(() => ({})) as { success?: boolean; result?: T; msg?: string; code?: number };
  if (!res.ok || data.success === false) {
    if (data.code === 1010 || data.code === 1011) tokens.delete(c.accessId);
    throw new Error(`Tuya Cloud refused the request${data.msg ? `: ${String(data.msg).slice(0, 140)}` : ` (${res.status})`}.`);
  }
  return data.result as T;
}

async function accessToken(c: TuyaCredentials) {
  const cached = tokens.get(c.accessId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const r = await call<{ access_token: string; expire_time: number }>(c, "GET", "/v1.0/token?grant_type=1", undefined, false);
  tokens.set(c.accessId, { token: r.access_token, expires: Date.now() + r.expire_time * 1000 });
  return r.access_token;
}

export async function getTuyaDeviceStates(c: TuyaCredentials, ids: string[]): Promise<TuyaDeviceState[]> {
  const out: TuyaDeviceState[] = [];
  for (const id of [...new Set(ids.map(normaliseTuyaDeviceId))]) {
    try {
      const d = await call<{ id: string; online: boolean; name?: string; product_name?: string; status?: Array<{ code: string; value: unknown }> }>(c, "GET", `/v1.0/devices/${encodeURIComponent(id)}`);
      out.push({ id: d.id, online: Boolean(d.online), name: d.name, product: d.product_name, codes: Object.fromEntries((d.status ?? []).map((s) => [s.code, s.value])) });
    } catch (e) {
      if (/permission|not exist|1106|2008/i.test(e instanceof Error ? e.message : "")) continue; // unknown to this project
      throw e;
    }
  }
  return out;
}

/** The switch codes a device exposes, in relay order: switch_1, switch_2… or a single "switch". */
export function tuyaSwitchCodes(state: TuyaDeviceState | undefined) {
  if (!state) return [];
  const numbered = Object.keys(state.codes).map((k) => /^switch_(\d+)$/.exec(k)).filter((m): m is RegExpExecArray => Boolean(m)).sort((a, b) => Number(a[1]) - Number(b[1])).map((m) => m[0]);
  if (numbered.length) return numbered;
  return ["switch", "switch_led"].filter((k) => k in state.codes).slice(0, 1);
}
export function tuyaOutput(state: TuyaDeviceState | undefined, channel: number): boolean | null {
  const code = tuyaSwitchCodes(state)[channel];
  const v = code ? state!.codes[code] : undefined;
  return typeof v === "boolean" ? v : null;
}

export async function setTuyaSwitch(c: TuyaCredentials, state: TuyaDeviceState, channel: number, on: boolean, pulseSeconds?: number) {
  const code = tuyaSwitchCodes(state)[channel];
  if (!code) throw new Error("This relay doesn't exist on the Tuya device.");
  const commands: Array<{ code: string; value: unknown }> = [{ code, value: on }];
  const countdown = code.replace(/^switch/, "countdown");
  const hasCountdown = pulseSeconds && countdown in state.codes;
  if (hasCountdown) commands.push({ code: countdown, value: Math.max(1, Math.round(pulseSeconds!)) });
  await call(c, "POST", `/v1.0/devices/${encodeURIComponent(state.id)}/commands`, { commands });
  // Devices without a countdown timer are switched back by us.
  if (pulseSeconds && !hasCountdown) setTimeout(() => { call(c, "POST", `/v1.0/devices/${encodeURIComponent(state.id)}/commands`, { commands: [{ code, value: !on }] }).catch((e) => console.error("[tuya] pulse off failed", e)); }, pulseSeconds * 1000);
}
