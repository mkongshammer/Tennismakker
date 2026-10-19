import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { loadIsolatedModule } from "./testing/isolated-module";

function harness(input?: {
  emailKey?: string;
  dailyCount?: number;
  prospects?: Array<Record<string, string>>;
  providerStatus?: number;
  discoveryFailures?: number;
}) {
  const rows: any[] = [];
  const fetchCalls: string[] = [];
  let discoveryAttempts = 0;
  const db = {
    $transaction: async (operations: Promise<any>[]) => Promise.all(operations),
    platformSetting: {
      create: async (input: any) => { rows.push(input.data); return input.data; },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 1 }),
      findUnique: async () => null,
      count: async () => input?.dailyCount ?? 0,
      upsert: async (input: any) => { rows.push(input.create); return input.create; },
    },
  };
  const mocks = {
    "node:crypto": crypto,
    "node:net": net,
    "./db": { db },
    "./agent-config": { getAgentConfig: async () => ({
      enabled: true, apiKeySet: true, apiKey: "test-openai-key",
      salesEnabled: true, salesDailyLimit: 3, salesPostalAddress: "",
      smartModel: "gpt-test",
    }) },
    "./settings": { getSettings: async () => ({
      emailApiKey: input?.emailKey === undefined ? "test-resend-key" : input.emailKey,
      emailFrom: "RacketBuddy <hello@racketbuddy.app>",
      ordersEmail: "", appUrl: "https://racketbuddy.app",
    }) },
    "./club-onboarding": { clubSignupPriceBook: async () => ({
      USD: { standard: 50, custom: null }, EUR: { standard: 27, custom: 1999 },
    }) },
    "./region": { deploymentRegion: () => "EU" },
  };
  const module = loadIsolatedModule("src/lib/sales-autopilot.ts", mocks);
  const restore = globalThis.fetch;
  globalThis.fetch = async (inputUrl: string | URL | Request) => {
    const url = String(inputUrl);
    fetchCalls.push(url);
    if (url.includes("api.openai.com")) {
      discoveryAttempts++;
      if (discoveryAttempts <= (input?.discoveryFailures ?? 0)) throw new Error("Research service timed out");
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ prospects: input?.prospects ?? [] }),
      }), { status: 200 });
    }
    if (url.includes("api.resend.com")) {
      return new Response(input?.providerStatus === 403
        ? JSON.stringify({ message: "Sender domain is not verified" })
        : JSON.stringify({ id: "example-provider-message-id" }),
        { status: input?.providerStatus ?? 200 });
    }
    const site = /^https:\/\/(club\d+\.example)\/contact$/.exec(url);
    if (site) {
      const response = new Response(`Contact: hello@${site[1]}`, { status: 200 });
      Object.defineProperty(response, "url", { value: url });
      return response;
    }
    throw new Error("Unexpected request: " + url);
  };
  return { module, db, rows, fetchCalls, restore: () => { globalThis.fetch = restore; } };
}

const distinctClubs = [1, 2, 3].map((n) => ({
  clubName: `Example Club ${n}`, sport: "tennis", city: "Austin", state: "TX",
  website: `https://club${n}.example`, sourceUrl: `https://club${n}.example/contact`,
  contactEmail: `hello@club${n}.example`, hook: "You offer tennis courts.",
}));

test("Sunday US business hours are eligible, with independent daily cap", async () => {
  const h = harness({ dailyCount: 3 });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.reason, "daily-limit-reached");
    assert.equal(result.sent, 0);
    assert.equal(h.fetchCalls.length, 0);
  } finally { h.restore(); }
});

test("AI key and Resend key are separate: missing email key blocks sending", async () => {
  const h = harness({ emailKey: "" });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.reason, "email-unconfigured");
    assert.equal(result.sent, 0);
    assert.equal(h.fetchCalls.length, 0);
  } finally { h.restore(); }
});

test("Club discovery is not blocked by Stripe/tax/webhook readiness", async () => {
  const h = harness();
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.ran, true);
    assert.equal(result.sent, 0);
    assert.ok(h.fetchCalls.some((url) => url.includes("api.openai.com")));
  } finally { h.restore(); }
});

test("Unverified Resend sender is reported as a failure, never a sent email", async () => {
  const h = harness({
    providerStatus: 403,
    prospects: distinctClubs,
  });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.reason, "mail-provider-blocked");
    assert.equal(result.verified, 3);
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.ok(result.detail?.includes("Resend HTTP 403"));
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.resend.com")).length, 1);
  } finally { h.restore(); }
});


test("Transient discovery failures are retried before attempting email delivery", async () => {
  const h = harness({
    discoveryFailures: 1,
    prospects: distinctClubs,
  });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.sent, 3);
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.openai.com")).length, 2);
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.resend.com")).length, 3);
  } finally { h.restore(); }
});

test("Exhausted discovery retries fail visibly without attempting any send", async () => {
  const h = harness({ discoveryFailures: 3 });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.reason, "discovery-failed");
    assert.equal(result.sent, 0);
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.openai.com")).length, 3);
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.resend.com")).length, 0);
  } finally { h.restore(); }
});


test("No outbound mail is attempted until three distinct prospects verify", async () => {
  const h = harness({ prospects: distinctClubs.slice(0, 2) });
  try {
    const result = await h.module.runSalesAutopilot(new Date("2026-10-18T14:00:00Z"));
    assert.equal(result.reason, "insufficient-verified-prospects");
    assert.equal(result.verified, 2);
    assert.equal(result.sent, 0);
    assert.equal(h.fetchCalls.filter((url) => url.includes("api.resend.com")).length, 0);
  } finally { h.restore(); }
});
