// "Webhook" provider for lights and doors: RacketBuddy calls an HTTPS address
// the club controls (Home Assistant, Node-RED, a lighting controller's own
// web API, Zapier, a Lutron bridge...) with a signed JSON message. The club's
// side switches the light or opens the door and answers 2xx.
//
// Body: { event: "light.on" | "light.off" | "door.open" | "test", output, label,
//         seconds?, club, sentAt }
// Header X-RacketBuddy-Signature: sha256=<hex HMAC-SHA256 of the raw body with
//         the club's signing secret>. X-RacketBuddy-Timestamp: unix seconds.
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export function newWebhookSecret() {
  return `rbwh_${crypto.randomBytes(24).toString("base64url")}`;
}

function privateAddress(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

/** Only public HTTPS addresses: the call is made from our server, so a free URL would reach our own network. */
export async function normaliseWebhookUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Enter the full https:// address of your webhook."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The webhook must be an https:// address without a username or password in it.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || net.isIP(host)) throw new Error("Use a public host name for the webhook, not an IP address or a local name.");
  const addresses = await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("The webhook host name could not be found.");
  if (addresses.some((a) => privateAddress(a.address))) throw new Error("The webhook points to a private network address.");
  return url.toString();
}

export function signWebhook(secret: string, body: string, timestamp: number) {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export type WebhookEvent = { event: "light.on" | "light.off" | "door.open" | "test"; output: number; label: string | null; seconds?: number; club: string };

/** Sends one event; throws with a short reason when the club's endpoint doesn't answer 2xx. */
export async function sendWebhook(url: string, secret: string, e: WebhookEvent) {
  const safe = await normaliseWebhookUrl(url);
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ ...e, sentAt: new Date().toISOString() });
  let res: Response;
  try {
    res = await fetch(safe, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "RacketBuddy-Control/1.0", "x-racketbuddy-timestamp": String(timestamp), "x-racketbuddy-signature": signWebhook(secret, body, timestamp) },
      body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    throw new Error(err instanceof Error && err.name === "TimeoutError" ? "The webhook didn't answer within 8 seconds." : "The webhook could not be reached.");
  }
  if (!res.ok) throw new Error(`The webhook answered ${res.status}.`);
}
