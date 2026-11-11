// One-off end-to-end test of the automatic club set-up (11 Nov 2026), without
// any real club: a test lead that is never sent to Instantly, a sample reply
// run through the same AI + set-up code as a real one, and the result mailed
// to the owner (nothing is sent to anyone else).
import { db } from "./db";
import { hash } from "./sales-autopilot";

const FLAG = "oneoff:setup-test:2026-11-11";
export const TEST_EMAIL = "setup-test@racketbuddy-test.invalid";

export async function runSetupTestOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const key = `sales:lead:${hash(TEST_EMAIL)}`;
  const lead = { clubName: "Test Racquet Club", sport: "tennis;pickleball", city: "Austin", state: "Texas", website: "https://racketbuddy.app", email: TEST_EMAIL, firstName: "", sourceUrl: "test", createdAt: new Date().toISOString(), exportedAt: new Date().toISOString() };
  await db.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(lead) }, update: { value: JSON.stringify(lead) } });
  const { decide, applySetup } = await import("./email-assistant");
  const text = "Sure, go ahead. We have 6 tennis courts and 4 pickleball courts, open 6am to 10pm. Non-members pay $35 an hour. Address is 1200 Barton Springs Rd, 78704. Ask for Dana.";
  let report: string;
  try {
    const first = await decide("sales", { from: TEST_EMAIL, subject: "Re: Test Racquet Club on RacketBuddy", text, context: "The sender is a club: Test Racquet Club, Austin, Texas (https://racketbuddy.app)." });
    const d = await applySetup(TEST_EMAIL, first);
    const { previewId } = await import("./club-preview");
    const { preparedSetup } = await import("./club-setup");
    report = [
      "TEST af automatisk klubopsætning (ingen rigtig klub, intet sendt til andre end dig).",
      "",
      `Testsvar fra 'klubben': ${text}`,
      "",
      `AI'en forstod: ${JSON.stringify(first.setup)}`,
      `Gemt opsætning: ${JSON.stringify(await preparedSetup(previewId(TEST_EMAIL)))}`,
      `Handling: ${d.action} / ${d.interest} / ${d.category}`,
      "",
      "Svaret klubben ville få:",
      "----",
      d.reply,
      "----",
    ].join("\n");
  } catch (e) {
    report = `TEST af automatisk klubopsætning FEJLEDE: ${e instanceof Error ? e.message : e}`;
    console.error("[setup-test]", e);
  }
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: TEST af automatisk klubopsætning", report);
  return { ran: true };
}

/** Removes the test club again (so it never shows up in lists, votes or counts). */
export async function cleanupSetupTestOnce() {
  const flag = "oneoff:setup-test-cleanup:2026-11-11";
  if (await db.platformSetting.findUnique({ where: { key: flag } }).catch(() => null)) return;
  const { previewId } = await import("./club-preview");
  const id = previewId(TEST_EMAIL);
  await db.platformSetting.deleteMany({ where: { OR: [{ key: `sales:lead:${hash(TEST_EMAIL)}` }, { key: `sales:prepared-setup:${id}` }, { key: `sales:preview-view:${id}` }, { key: `sales:preview-followup:${id}` }, { key: { startsWith: `sales:preview-visit:${id}:` } }] } });
  await db.platformSetting.create({ data: { key: flag, value: new Date().toISOString() } });
}
