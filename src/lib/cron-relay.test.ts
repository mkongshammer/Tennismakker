import test from "node:test";
import assert from "node:assert/strict";

test("only the EU service relays cron runs, and only with an origin and secret", async () => {
  const saved = { ...process.env };
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: URL, init: RequestInit) => { calls.push(`${String(url)} ${(init.headers as Record<string, string>).Authorization?.slice(0, 7)}`); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }) as typeof fetch;
  try {
    const { relayCronToUS } = await import("./cron-jobs");
    Object.assign(process.env, { RACKETBUDDY_REGION: "US", REGIONAL_SHARDING_ACTIVE: "true" });
    assert.deepEqual(await relayCronToUS("sync"), { relayed: false });
    Object.assign(process.env, { RACKETBUDDY_REGION: "EU", US_APP_URL: "https://racketbuddy.app", REGION_INTERNAL_SECRET: "x".repeat(40) });
    delete process.env.US_INTERNAL_ORIGIN;
    const r = await relayCronToUS("club-control");
    assert.equal(r.relayed, true);
    assert.deepEqual(calls, ["https://racketbuddy.app/api/internal/cron/club-control Bearer "]);
    delete process.env.REGION_INTERNAL_SECRET;
    assert.equal((await relayCronToUS("sync")).relayed, false);
  } finally { globalThis.fetch = realFetch; process.env = saved; }
});
