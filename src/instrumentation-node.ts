// Keeps the Stripe webhook listening on every event the current code needs,
// so a deploy that adds an event never waits for someone to click "repair".
setTimeout(async () => {
  try {
    const { addMissingWebhookEvents } = await import("./lib/webhook-setup");
    await addMissingWebhookEvents();
  } catch (err) {
    console.error("Stripe webhook check at startup failed:", err instanceof Error ? err.message : err);
  }
}, 15_000);

// The US service schedules its own background jobs (see lib/self-cron.ts).
setTimeout(async () => {
  try {
    const { startSelfCron } = await import("./lib/self-cron");
    startSelfCron();
  } catch (err) {
    console.error("Self cron failed to start:", err instanceof Error ? err.message : err);
  }
}, 30_000);

export {};
