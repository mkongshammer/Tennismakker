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

export {};
