// One interface over the light/door controllers a club can connect:
//   SHELLY  – Shelly Cloud relays
//   TUYA    – Tuya Cloud / Smart Life relays and switches
//   WEBHOOK – any system that accepts a signed HTTPS call (Home Assistant,
//             Node-RED, lighting controllers with a web API, a Lutron bridge…)
// The rest of RacketBuddy only knows devices and numbered relay channels.
import { open as unseal } from "./crypto-box";
import { getShellyDeviceStates, setShellySwitchGroup, shellyChannelCount, shellySwitchOutput } from "./shelly-cloud";
import { getTuyaDeviceStates, setTuyaSwitch, tuyaOutput, tuyaSwitchCodes, type TuyaDeviceState } from "./tuya-cloud";
import { sendWebhook } from "./control-webhook";

export type ControlProvider = "SHELLY" | "TUYA" | "WEBHOOK";
export const CONTROL_PROVIDERS: Array<{ id: ControlProvider; label: string }> = [
  { id: "SHELLY", label: "Shelly" },
  { id: "TUYA", label: "Tuya / Smart Life" },
  { id: "WEBHOOK", label: "Webhook (Home Assistant, Lutron bridge, other systems)" },
];

export type StoredControl = { id: string; provider?: string | null; serverUrl: string; authKeyCipher: string; club?: { name: string } | null };
export type DeviceState = { id: string; online: 0 | 1; code?: string; channelCount: number | null; output: (channel: number) => boolean | null };
export type SwitchRef = { deviceId: string; channel: number; label?: string | null };
export type GroupResult = { failed: Map<string, string> };

export const refKey = (r: { deviceId: string; channel: number }) => `${r.deviceId}_${r.channel}`.toLowerCase();
export const providerOf = (c: StoredControl): ControlProvider => (c.provider === "TUYA" || c.provider === "WEBHOOK" ? c.provider : "SHELLY");

function secret(c: StoredControl) {
  const s = unseal(c.authKeyCipher);
  if (!s) throw new Error("The saved key couldn't be read. Save the connection again.");
  return s;
}
function tuyaCreds(c: StoredControl) {
  const parsed = JSON.parse(secret(c)) as { accessId: string; secret: string };
  return { endpoint: c.serverUrl, accessId: parsed.accessId, secret: parsed.secret };
}

/** Rate limit per club account (Shelly allows about one call a second; Tuya is similar). */
const tails = new Map<string, Promise<unknown>>();
const lastCall = new Map<string, number>();
function limited<T>(controlId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(controlId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(async () => {
    const wait = 1_050 - (Date.now() - (lastCall.get(controlId) ?? 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall.set(controlId, Date.now());
    return fn();
  });
  tails.set(controlId, next);
  return next;
}

const tuyaCache = new Map<string, TuyaDeviceState>();

export async function inspectDevices(c: StoredControl, deviceIds: string[]): Promise<DeviceState[]> {
  const provider = providerOf(c);
  if (provider === "WEBHOOK") return deviceIds.map((id) => ({ id, online: 1, channelCount: null, output: () => null }));
  if (provider === "TUYA") {
    const states = await limited(c.id, () => getTuyaDeviceStates(tuyaCreds(c), deviceIds));
    return states.map((s) => {
      tuyaCache.set(`${c.id}:${s.id}`, s);
      return { id: s.id, online: s.online ? 1 : 0, code: s.product, channelCount: tuyaSwitchCodes(s).length || null, output: (ch) => tuyaOutput(s, ch) };
    });
  }
  const states = await limited(c.id, () => getShellyDeviceStates({ serverUrl: c.serverUrl, authKey: secret(c) }, deviceIds));
  return states.map((s) => ({ id: s.id, online: s.online, code: s.code, channelCount: shellyChannelCount(s), output: (ch) => shellySwitchOutput(s, ch) }));
}

export async function commandGroup(c: StoredControl, refs: SwitchRef[], on: boolean, pulseSeconds?: number, event?: "door" | "test"): Promise<GroupResult> {
  const failed = new Map<string, string>();
  if (!refs.length) return { failed };
  const provider = providerOf(c);
  if (provider === "SHELLY") {
    return limited(c.id, () => setShellySwitchGroup({ serverUrl: c.serverUrl, authKey: secret(c) }, refs, on, pulseSeconds));
  }
  if (provider === "TUYA") {
    const creds = tuyaCreds(c);
    for (const r of refs) {
      try {
        let state = tuyaCache.get(`${c.id}:${r.deviceId}`);
        if (!state) state = (await limited(c.id, () => getTuyaDeviceStates(creds, [r.deviceId])))[0];
        if (!state) throw new Error("The device isn't in the Tuya project.");
        await limited(c.id, () => setTuyaSwitch(creds, state!, r.channel, on, pulseSeconds));
      } catch (e) { failed.set(refKey(r), e instanceof Error ? e.message : "Tuya command failed."); }
    }
    return { failed };
  }
  const key = secret(c);
  for (const r of refs) {
    try {
      await sendWebhook(c.serverUrl, key, {
        event: event === "test" ? "test" : event === "door" ? "door.open" : on ? "light.on" : "light.off",
        output: r.channel + 1, label: r.label ?? null, club: c.club?.name ?? "",
        ...(pulseSeconds ? { seconds: Math.round(pulseSeconds) } : {}),
      });
    } catch (e) { failed.set(refKey(r), e instanceof Error ? e.message : "Webhook failed."); }
  }
  return { failed };
}
