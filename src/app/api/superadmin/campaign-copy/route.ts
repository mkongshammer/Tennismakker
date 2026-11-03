// Superadmin only, read-only: the live Instantly sales campaigns (settings and every e-mail variant) for proofreading.
import { getCurrentUser } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new Response("Not found", { status: 404 });
  if (!process.env.INSTANTLY_API_KEY) return Response.json({ error: "No Instantly key on this service." }, { status: 503 });
  const { coachCampaignId } = await import("../../../../lib/instantly-coach-campaign");
  const ids = [process.env.INSTANTLY_CAMPAIGN_ID, await coachCampaignId()].filter((x): x is string => Boolean(x));
  const out = [];
  for (const id of ids) {
    const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${process.env.INSTANTLY_API_KEY}` }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) { out.push({ id, error: res.status }); continue; }
    const c = await res.json() as Record<string, any>;
    out.push({
      id, name: c.name, status: c.status, daily_limit: c.daily_limit, email_list: c.email_list, stop_on_reply: c.stop_on_reply,
      link_tracking: c.link_tracking, open_tracking: c.open_tracking, text_only: c.text_only, campaign_schedule: c.campaign_schedule,
      steps: (c.sequences?.[0]?.steps ?? []).map((s: any) => ({ delay: s.delay, variants: (s.variants ?? []).map((v: any) => ({ subject: v.subject, body: v.body, disabled: v.v_disabled })) })),
    });
  }
  return Response.json(out);
}
