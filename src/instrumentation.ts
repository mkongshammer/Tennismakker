// Runs once when the server starts. Keeps the Stripe webhook listening on
// every event the current code needs, so a deploy that adds an event never
// waits for someone to click "repair" in the admin.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  setTimeout(async () => {
    try {
      const { addMissingWebhookEvents } = await import("./lib/webhook-setup");
      await addMissingWebhookEvents();
    } catch (err) {
      console.error("Stripe webhook check at startup failed:", err instanceof Error ? err.message : err);
    }
  }, 15_000);
}
