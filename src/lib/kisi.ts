// Kisi (kisi.io) cloud access control. The club pastes an API key from
// Kisi; we list their locks so they can pick the door, and unlock it when a
// player with a booking taps "Open door" in the app.
//
// API: https://api.kisi.io, header "Authorization: KISI-LOGIN <key>".

const BASE = process.env.KISI_API_BASE || "https://api.kisi.io";

async function kisi<T>(apiKey: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: init?.method ?? "GET", headers: { Authorization: `KISI-LOGIN ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" }, body: init?.body ? JSON.stringify(init.body) : undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text; try { const j = JSON.parse(text) as { error?: string; code?: string }; detail = j.error ?? j.code ?? text; } catch { /* keep text */ }
    throw Error(`Kisi ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => undefined)) as T;
}

export type KisiLock = { id: number; name: string; place?: { id: number; name: string } | null; online?: boolean; unlocked?: boolean };

export async function kisiLocks(apiKey: string): Promise<KisiLock[]> {
  const locks = await kisi<KisiLock[]>(apiKey, "/locks?limit=100");
  return (locks ?? []).map((l) => ({ id: l.id, name: l.name, place: l.place ?? null, online: l.online, unlocked: l.unlocked }));
}

/** A momentary unlock. Kisi relocks on its own after the lock's configured time. */
export async function kisiUnlock(apiKey: string, lockId: string | number) {
  await kisi(apiKey, `/locks/${lockId}/unlock`, { method: "POST", body: {} });
  return { ok: true as const };
}
