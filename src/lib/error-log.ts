// Server errors, kept where they can be read without access to the hosting
// logs: the last 150 console.error/console.warn lines are saved in the
// database every 30 seconds, shown in superadmin ("Fejllog") and summed up
// in the morning sales mail when there were any.
import { db } from "./db";

const KEY = "ops:error-log";
const MAX = 150;
export type ErrorEntry = { at: string; level: "error" | "warn"; msg: string };

let pending: ErrorEntry[] = [];
let installed = false;

function format(args: unknown[]) {
  return args.map((a) => (a instanceof Error ? `${a.message}${a.stack ? ` @ ${a.stack.split("\n")[1]?.trim() ?? ""}` : ""}` : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ")
    // never store secrets that might appear in an error
    .replace(/(sk|rk|pk|whsec|re)_[A-Za-z0-9_]{12,}/g, "$1_***").replace(/Bearer\s+[A-Za-z0-9._-]{12,}/g, "Bearer ***").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, (m) => `${m.slice(0, 2)}***@${m.split("@")[1]}`)
    .slice(0, 600);
}

export async function flushErrors() {
  if (!pending.length) return;
  const batch = pending;
  pending = [];
  try {
    const row = await db.platformSetting.findUnique({ where: { key: KEY } });
    const prev = row ? (JSON.parse(row.value) as ErrorEntry[]) : [];
    const next = [...prev, ...batch].slice(-MAX);
    await db.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  } catch { /* the log must never break the app */ }
}

export function installErrorLog() {
  if (installed) return;
  installed = true;
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      try { if (pending.length < 300) pending.push({ at: new Date().toISOString(), level, msg: format(args) }); } catch { /* ignore */ }
    };
  }
  setInterval(() => { void flushErrors(); }, 30_000).unref?.();
}

export async function recentErrors(limit = MAX): Promise<ErrorEntry[]> {
  const row = await db.platformSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  const list = row ? (JSON.parse(row.value) as ErrorEntry[]) : [];
  return list.slice(-limit).reverse();
}

/** For the morning mail: errors in the last 24 h, grouped by message. */
export async function errorSummary(now = Date.now()) {
  const since = now - 86_400_000;
  const recent = (await recentErrors()).filter((e) => e.level === "error" && Date.parse(e.at) >= since);
  const groups = new Map<string, number>();
  for (const e of recent) { const k = e.msg.replace(/\d+/g, "#").slice(0, 140); groups.set(k, (groups.get(k) ?? 0) + 1); }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}
