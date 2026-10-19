import test from "node:test";
import assert from "node:assert/strict";

const withEnv = async (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try { await fn(); } finally { process.env = saved; }
};

test("US deployment writes every message in American English with US defaults", async () => {
  await withEnv({ RACKETBUDDY_REGION: "US", REGIONAL_SHARDING_ACTIVE: "true" }, async () => {
    const { messageLocale, messageTimeZone, messageCurrency } = await import("./mail-locale");
    assert.equal(messageLocale("da"), "en-US");
    assert.equal(messageLocale(undefined), "en-US");
    assert.equal(messageTimeZone(undefined), "America/New_York");
    assert.equal(messageTimeZone("America/Chicago"), "America/Chicago");
    assert.equal(messageCurrency(undefined), "USD");
    const { passwordResetLink } = await import("./email");
    const mail = passwordResetLink({ locale: "da", to: "a@b.c", name: "Sam", url: "https://racketbuddy.app/login/reset?token=x", minutes: 60 });
    assert.doesNotMatch(mail.subject + mail.body, /adgangskode|Hej |linket/i, mail.subject + "\n" + mail.body);
  });
});

test("outside the US the user's own locale still applies", async () => {
  await withEnv({ RACKETBUDDY_REGION: "EU" }, async () => {
    const { messageLocale, messageTimeZone, messageCurrency } = await import("./mail-locale");
    assert.equal(messageLocale("da"), "da");
    assert.equal(messageLocale("de"), "de");
    assert.equal(messageLocale(undefined), "da");
    assert.equal(messageTimeZone(undefined), "Europe/Copenhagen");
    assert.equal(messageCurrency(undefined), "DKK");
  });
});
