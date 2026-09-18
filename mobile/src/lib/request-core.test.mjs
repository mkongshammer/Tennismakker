import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchJson, resolveCheckoutUrl } from "./request-core.mjs";
import { mergeMessages } from "./messages.mjs";
import { groupByDay, isoDay } from "./dates.js";

test("returns decoded data and sends the bearer header unchanged", async t => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test");
    return new Response(JSON.stringify({ bookings: [] }));
  });
  assert.deepEqual(await fetchJson("https://example.test", { headers: { Authorization: "Bearer test" } }), { bookings: [] });
});
test("preserves HTTP status and server error for expired sessions", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response('{"error":"Log ind igen"}', { status: 401 }));
  await assert.rejects(fetchJson("https://example.test"), error => error.status === 401 && error.message === "Log ind igen");
});
test("gives a useful error for non-JSON server failures", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(fetchJson("https://example.test"), /Serveren svarede ikke korrekt/);
});
test("explains offline errors", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(fetchJson("https://example.test"), /Tjek dit netværk/);
});
test("times out without retrying mutations or implying they failed", async t => {
  let attempts = 0;
  t.mock.method(globalThis, "fetch", (_url, options) => {
    attempts++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("Abort"))));
  });
  await assert.rejects(fetchJson("https://example.test", { method: "POST" }, 5), /Kontrollér om handlingen er gennemført/);
  assert.equal(attempts, 1);
});
test("timeout also covers reading the response body", async t => {
  t.mock.method(globalThis, "fetch", async (_url, options) => ({
    ok: true,
    text: () => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("Abort")))),
  }));
  await assert.rejects(fetchJson("https://example.test", {}, 5), /Forbindelsen er langsom/);
});
test("rejects missing or unsafe checkout links", () => {
  for (const value of [undefined, "", "javascript:alert(1)", "http://example.test", "https://user:pass@example.test"]) {
    assert.throws(() => resolveCheckoutUrl(value, "https://racketbuddy.app"));
  }
  assert.equal(resolveCheckoutUrl("/checkout/test", "https://racketbuddy.app"), "https://racketbuddy.app/checkout/test");
  assert.equal(resolveCheckoutUrl("https://checkout.stripe.com/test", "https://racketbuddy.app"), "https://checkout.stripe.com/test");
});
test("polling and send responses never duplicate or lose a just-sent message", () => {
  const first = { id: "a", createdAt: "2026-09-18T12:00:00Z", body: "Hej" };
  const second = { id: "b", createdAt: "2026-09-18T12:01:00Z", body: "Vi ses" };
  assert.deepEqual(mergeMessages([first], [second]), [first, second]);
  assert.deepEqual(mergeMessages([second, first], [second]), [first, second]);
});
test("day groups match displayed local dates across UTC midnight", () => {
  const before = process.env.TZ;
  process.env.TZ = "Europe/Copenhagen";
  try {
    const dates = [new Date("2026-09-18T23:00:00Z"), new Date("2026-09-19T08:00:00Z")];
    assert.equal(isoDay(dates[0]), "2026-09-19");
    assert.equal(groupByDay(dates, date => date).length, 1);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
