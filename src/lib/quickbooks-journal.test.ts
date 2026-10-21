import test from "node:test";
import assert from "node:assert/strict";
import { balanced, journalFor } from "./quickbooks";
import type { RevenueLine } from "./reports";

const line = (category: RevenueLine["category"], amountKr: number, method: string, feeKr = 0): RevenueLine => ({ date: new Date("2026-11-03T15:00:00Z"), category, description: "", customer: "", amountKr, feeKr, currency: "USD", method, ref: "" });

test("a day's revenue becomes one balanced journal entry with income per category", () => {
  const j = journalFor([
    line("Court bookings", 38, "Card", 4), line("Court bookings", 38, "Card (test)", 4),
    line("Memberships", 600, "Card"), line("Memberships", 300, "Cash/check"), line("Memberships", 200, "Free"),
    line("Pro shop", 12, "Cash"), line("Pro shop", 45, "Card (desk)"),
  ]);
  assert.ok(balanced(j));
  const get = (account: string, side: string) => j.find((l) => l.account === account && l.side === side)?.amount;
  assert.equal(get("income:Court bookings", "Credit"), 76);
  assert.equal(get("income:Memberships", "Credit"), 900); // the free one moved no money
  assert.equal(get("income:Pro shop", "Credit"), 57);
  assert.equal(get("cash", "Debit"), 312);
  assert.equal(get("deskCard", "Debit"), 45);
  assert.equal(get("clearing", "Debit"), 76 + 600 - 8);
  assert.equal(get("fees", "Debit"), 8);
});

test("no lines, no entry", () => {
  assert.deepEqual(journalFor([]), []);
  assert.deepEqual(journalFor([line("Memberships", 100, "Free")]), []);
});
