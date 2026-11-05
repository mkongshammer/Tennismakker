// One-off (5 Nov 2026), run once from the US cron:
// 1) remove the direct Stripe webhook to the US service that was added by
//    mistake — the EU service's endpoint already relays US events;
// 2) dry-run a live club checkout (created and expired at once, nothing paid)
//    and e-mail the owner what Stripe would charge.
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { deploymentRegion, regionalShardingActive } from "./region";

const KEY = "stripe:oneoff:2026-11-05";

export async function runStripeOneOff() {
  if (deploymentRegion() !== "US" || !regionalShardingActive()) return null;
  if (await db.platformSetting.findUnique({ where: { key: KEY } })) return null;
  await db.platformSetting.create({ data: { key: KEY, value: new Date().toISOString() } });
  const lines: string[] = [];
  const client = await stripe();
  const settings = await getSettings();
  try {
    const mine = `${settings.appUrl}/api/webhooks/stripe`;
    const list = (await client.webhookEndpoints.list({ limit: 100 })).data;
    const eu = list.filter((e) => e.url !== mine && e.status === "enabled");
    if (eu.length) {
      for (const e of list.filter((x) => x.url === mine)) { await client.webhookEndpoints.del(e.id); lines.push(`Fjernede den dobbelte webhook ${e.id} (${e.url}).`); }
      lines.push(`Aktiv webhook: ${eu.map((e) => e.url).join(", ")} (videresender amerikanske betalinger).`);
    } else lines.push("Fandt ingen aktiv EU-webhook, så intet blev fjernet.");
  } catch (e) { lines.push(`Webhook-oprydning fejlede: ${e instanceof Error ? e.message : e}`); }
  try {
    const { clubSignupPrices } = await import("./club-onboarding");
    const p = await clubSignupPrices("US");
    const tax = (await client.tax.settings.retrieve()).status;
    const s = await client.checkout.sessions.create({
      mode: "subscription", adaptive_pricing: { enabled: false }, automatic_tax: { enabled: true }, billing_address_collection: "required", tax_id_collection: { enabled: true }, payment_method_types: ["card"], locale: "en",
      line_items: [{ quantity: 1, price_data: { tax_behavior: "exclusive", currency: "usd", unit_amount: p.standard * 100, recurring: { interval: "month" }, product_data: { name: "RacketBuddy for clubs – dry run (expired immediately)" } } }],
      metadata: { dryRun: "1", region: "US" }, success_url: `${settings.appUrl}/club-start?betaling=kontroller`, cancel_url: `${settings.appUrl}/club-start?betaling=afbrudt`,
    });
    const items = await client.checkout.sessions.listLineItems(s.id);
    const ex = await client.checkout.sessions.expire(s.id);
    lines.push(`Prøvebetaling: Stripe oprettede betalingssiden (${s.livemode ? "live" : "test"}), ${items.data.map((l) => `${l.description} ${(l.amount_total / 100).toFixed(2)} ${s.currency?.toUpperCase()}/${l.price?.recurring?.interval}`).join("; ")}. Sales tax i Stripe: ${tax}. Siden blev lukket igen med det samme (${ex.status}); der er ikke trukket noget.`);
  } catch (e) { lines.push(`Prøvebetalingen fejlede: ${e instanceof Error ? e.message : e}`); }
  console.log("[stripe-oneoff]", lines.join(" | "));
  await db.platformSetting.update({ where: { key: KEY }, data: { value: JSON.stringify({ at: new Date().toISOString(), lines }) } });
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: tjek af klubbetaling", lines.join("\n\n"));
  return lines;
}
