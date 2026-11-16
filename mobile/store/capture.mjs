// Captures the real app screens for the store listings.
//
// Runs the app in a browser at phone size, signs in as the demo player and
// photographs each tab at 3× so the pictures are sharp on a store page.
// Usage: node capture.mjs <out dir> [night|light]
import pw from "/opt/npm-tools/node_modules/playwright/index.js";
const { chromium } = pw;
import fs from "node:fs";

const out = process.argv[2] ?? "./shots";
const theme = process.argv[3] ?? "night";
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await ctx.addInitScript((t) => { try { localStorage.setItem("rb_theme", t); } catch {} }, theme);
const p = await ctx.newPage();
const shot = async (name) => { await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${name}.png` }); console.log("·", name); };
const tab = async (label) => { const t = p.getByText(label).last(); if (await t.count()) { await t.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(3500); } };

await p.goto("http://127.0.0.1:8088/", { waitUntil: "load", timeout: 180000 });
await p.waitForTimeout(9000);
const email = p.locator("input[type=email], input[inputmode=email]").first();
if (await email.count()) {
  await email.fill("player@racketbuddy.test");
  await p.locator("input[type=password]").first().fill("racket123");
  await p.getByText(/Log in with email/i).first().click();
  await p.waitForTimeout(12000);
}
for (const label of [/Not now/i, /Ikke nu/i]) { const x = p.getByText(label).first(); if (await x.count()) { await x.click().catch(() => {}); await p.waitForTimeout(1200); } }

await tab(/^Players$/i); await shot("players");
await tab(/^Coaches$/i); await shot("coaches");
await tab(/^Messages$/i); await shot("messages");
const initials = p.getByText(/^JL$/).first();
if (await initials.count()) { await initials.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(3500); await shot("profile"); const close = p.getByText(/^Close$|^Luk$/).first(); if (await close.count()) await close.click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(2000); }
await tab(/Reserve a court/i); await shot("courts");
const club = p.getByText(/Brookline Racquet Club/i).first();
if (await club.count()) { await club.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(4500); await shot("club"); }
await b.close();
