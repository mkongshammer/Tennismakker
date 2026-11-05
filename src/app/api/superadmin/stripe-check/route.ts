// Superadmin only. GET: the Stripe webhook endpoints and the region setup.
// POST ?action=remove-us-duplicate: removes a webhook pointing straight at this
// US service when the EU relay is in use (the relay is the single endpoint).
// POST ?action=dry-run-checkout: creates a live Checkout Session exactly like a
// new US club would get ($50/month founding price, sales tax on), reads back
// what Stripe would charge, then expires it at once. Nothing is paid or saved.
import { getCurrentUser } from "../../../../lib/session";
import { stripe } from "../../../../lib/stripe";
import { getSettings } from "../../../../lib/settings";
import { deploymentRegion, regionalShardingActive } from "../../../../lib/region";
import { WEBHOOK_PATH } from "../../../../lib/webhook-setup";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

async function guard() {
  const u = await getCurrentUser();
  return u?.role === "SUPERADMIN";
}

async function endpoints() {
  const client = await stripe();
  return (await client.webhookEndpoints.list({ limit: 100 })).data.map((e) => ({ id: e.id, url: e.url, status: e.status, events: e.enabled_events.length, enabledEvents: e.enabled_events, created: new Date(e.created * 1000).toISOString(), description: e.description }));
}

export async function GET() {
  if (!(await guard())) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const evidence = await db.platformSetting.findMany({ where: { key: { in: ["stripeLastRelayedWebhookV1", "stripeLastVerifiedWebhookV1", "stripe:oneoff:2026-11-05"] } } });
  // Recent live events Stripe created for US club signups, and whether Stripe delivered them.
  const client = await stripe();
  const recent = (await client.events.list({ limit: 15 })).data.map((e) => ({ id: e.id, type: e.type, created: new Date(e.created * 1000).toISOString(), pendingWebhooks: e.pending_webhooks, region: (e.data.object as { metadata?: Record<string, string> }).metadata?.region ?? null }));
  return Response.json({ recent, evidence: Object.fromEntries(evidence.map((e) => [e.key, e.value])), region: deploymentRegion(), relay: regionalShardingActive(), appUrl: settings.appUrl, live: settings.stripeSecretKey.startsWith("sk_live_"), usOriginSet: Boolean(process.env.US_INTERNAL_ORIGIN ?? process.env.US_APP_URL), endpoints: await endpoints() });
}

export async function POST(req: Request) {
  if (!(await guard())) return new Response("Not found", { status: 404 });
  const action = new URL(req.url).searchParams.get("action");
  const client = await stripe();
  const settings = await getSettings();
  if (action === "remove-us-duplicate") {
    if (!(deploymentRegion() === "US" && regionalShardingActive())) return Response.json({ error: "Only for the US service with the EU relay." }, { status: 400 });
    const mine = `${settings.appUrl}${WEBHOOK_PATH}`.replace(/\/$/, "");
    const all = await endpoints();
    const others = all.filter((e) => e.url.replace(/\/$/, "") !== mine);
    if (!others.some((e) => e.status === "enabled")) return Response.json({ error: "No other enabled endpoint (the EU relay) found; nothing removed.", endpoints: all }, { status: 409 });
    const removed = [];
    for (const e of all.filter((x) => x.url.replace(/\/$/, "") === mine)) { await client.webhookEndpoints.del(e.id); removed.push(e.id); }
    return Response.json({ removed, endpoints: await endpoints() });
  }
  // US only: remove the EU service's webhook once the EU service is switched off.
  // Requires this service's own endpoint to be enabled, so events keep arriving.
  if (action === "remove-eu-endpoint") {
    if (deploymentRegion() !== "US") return Response.json({ error: "Only for the US service." }, { status: 400 });
    const mine = `${settings.appUrl}${WEBHOOK_PATH}`.replace(/\/$/, "");
    const all = await endpoints();
    if (!all.some((e) => e.url.replace(/\/$/, "") === mine && e.status === "enabled")) return Response.json({ error: "The US endpoint is not enabled; nothing removed.", endpoints: all }, { status: 409 });
    const removed = [];
    for (const e of all.filter((x) => /^https:\/\/eu\.racketbuddy\.app\//.test(x.url))) { await client.webhookEndpoints.del(e.id); removed.push(e.url); }
    return Response.json({ removed, endpoints: await endpoints() });
  }
  if (action === "dry-run-checkout") {
    const { clubSignupPrices } = await import("../../../../lib/club-onboarding");
    const p = await clubSignupPrices("US");
    const tax = (await client.tax.settings.retrieve()).status;
    const session = await client.checkout.sessions.create({
      mode: "subscription", adaptive_pricing: { enabled: false }, automatic_tax: { enabled: true }, billing_address_collection: "required", tax_id_collection: { enabled: true }, payment_method_types: ["card"], locale: "en",
      line_items: [{ quantity: 1, price_data: { tax_behavior: "exclusive", currency: "usd", unit_amount: p.standard * 100, recurring: { interval: "month" }, product_data: { name: "RacketBuddy for clubs – dry run (expired immediately)" } } }],
      metadata: { dryRun: "1", region: "US" }, success_url: `${settings.appUrl}/club-start?betaling=kontroller`, cancel_url: `${settings.appUrl}/club-start?betaling=afbrudt`,
    });
    const items = await client.checkout.sessions.listLineItems(session.id);
    const expired = await client.checkout.sessions.expire(session.id);
    return Response.json({ ok: true, livemode: session.livemode, taxSettings: tax, currency: session.currency, amountSubtotal: session.amount_subtotal, lineItems: items.data.map((l) => ({ description: l.description, amount: l.amount_total, interval: l.price?.recurring?.interval })), checkoutUrlWorked: Boolean(session.url), expired: expired.status });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
