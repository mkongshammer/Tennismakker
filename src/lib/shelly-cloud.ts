/**
 * Lille adapter omkring Shelly Cloud Control API v2.
 *
 * Resten af RacketBuddy kender kun til enheder og relækanaler. Hvis Shelly
 * ændrer beta-endpointet, er det derfor denne ene fil, der skal rettes.
 */

export type ShellyCredentials = {
  serverUrl: string;
  authKey: string;
};

export type ShellyDeviceState = {
  id: string;
  type?: string;
  code?: string;
  gen?: string;
  online: 0 | 1;
  status?: Record<string, unknown>;
};

export type ShellySwitchRef = {
  deviceId: string;
  channel: number;
};

export type ShellyGroupResult = {
  failed: Map<string, string>;
};

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Accepter kun Shellys HTTPS-hosts. Feltet bruges i server-side fetch, så
 * en fri URL ville være en SSRF-adgang til RacketBuddys interne netværk.
 */
export function normaliseShellyServerUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Angiv Server URI fra Shelly-appen.");

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Shelly Server URI er ikke en gyldig adresse.");
  }

  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(host === "shelly.cloud" || host.endsWith(".shelly.cloud"))
  ) {
    throw new Error("Server URI skal være en sikker adresse under shelly.cloud.");
  }

  return `https://${host}`;
}

export function normaliseShellyDeviceId(input: string): string {
  const id = input.trim().toLowerCase();
  if (!/^[a-z0-9_-]{6,64}$/.test(id)) {
    throw new Error("Shelly Device ID ser ikke gyldigt ud.");
  }
  return id;
}

function endpoint(credentials: ShellyCredentials, path: string) {
  const base = normaliseShellyServerUrl(credentials.serverUrl);
  const url = new URL(path, `${base}/`);
  url.searchParams.set("auth_key", credentials.authKey);
  return url;
}

async function postJson<T>(
  credentials: ShellyCredentials,
  path: string,
  body: unknown
): Promise<T> {
  if (!credentials.authKey) throw new Error("Shelly Authorization Cloud Key mangler.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint(credentials, path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Shelly Cloud svarede ikke inden for 10 sekunder.");
    }
    throw new Error("Kunne ikke få forbindelse til Shelly Cloud.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.data?.messages?.join(" ") ?? parsed?.error ?? "";
    } catch {
      detail = raw.slice(0, 180);
    }
    const safeDetail = String(detail).replaceAll(credentials.authKey, "[redacted]").slice(0, 180);
    const suffix = safeDetail ? `: ${safeDetail}` : "";
    throw new Error(`Shelly Cloud afviste kommandoen (${response.status})${suffix}`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Shelly Cloud returnerede et ugyldigt svar.");
  }
}

export async function getShellyDeviceStates(
  credentials: ShellyCredentials,
  deviceIds: string[]
): Promise<ShellyDeviceState[]> {
  const ids = [...new Set(deviceIds.map(normaliseShellyDeviceId))];
  if (ids.length === 0) return [];
  if (ids.length > 10) throw new Error("Shelly kan højst hente 10 enheder ad gangen.");

  const result = await postJson<unknown>(credentials, "/v2/devices/api/get", {
    ids,
    select: ["status"],
  });
  if (!Array.isArray(result)) {
    throw new Error("Shelly Cloud returnerede et ukendt svar.");
  }
  return result as ShellyDeviceState[];
}

function switchKey(ref: ShellySwitchRef) {
  return `${normaliseShellyDeviceId(ref.deviceId)}_${ref.channel}`;
}

/** Styr én eller flere relækanaler med den samme kommando. */
export async function setShellySwitchGroup(
  credentials: ShellyCredentials,
  refs: ShellySwitchRef[],
  on: boolean,
  toggleAfterSeconds?: number
): Promise<ShellyGroupResult> {
  if (refs.length === 0) return { failed: new Map() };
  for (const ref of refs) {
    if (!Number.isInteger(ref.channel) || ref.channel < 0 || ref.channel > 31) {
      throw new Error("Ugyldig Shelly-kanal.");
    }
  }

  const command: { on: boolean; toggle_after?: number } = { on };
  if (toggleAfterSeconds !== undefined) {
    command.toggle_after = Math.max(1, Math.min(60, Math.round(toggleAfterSeconds)));
  }

  const result = await postJson<{ failedCommands?: Record<string, string> }>(
    credentials,
    "/v2/devices/api/set/groups",
    {
      switch: {
        ids: refs.map(switchKey),
        command,
      },
    }
  );

  return {
    failed: new Map(
      Object.entries(result.failedCommands ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        String(value),
      ])
    ),
  };
}

export function shellySwitchOutput(
  state: ShellyDeviceState | undefined,
  channel: number
): boolean | null {
  const component = state?.status?.[`switch:${channel}`];
  if (!component || typeof component !== "object") return null;
  const output = (component as { output?: unknown }).output;
  return typeof output === "boolean" ? output : null;
}

export function shellyChannelCount(state: ShellyDeviceState | undefined): number | null {
  if (!state?.status) return null;
  const ids = Object.keys(state.status)
    .map((key) => /^switch:(\d+)$/.exec(key)?.[1])
    .filter((id): id is string => id !== undefined)
    .map(Number);
  if (ids.length === 0) return null;
  return Math.max(...ids) + 1;
}
