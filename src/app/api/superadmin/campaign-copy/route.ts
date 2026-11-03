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

// Sets the sending pace: { "<campaignId>": dailyLimit }, weekdays Monday–Friday, same hours and time zone.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return new Response("Not found", { status: 404 });
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) return Response.json({ error: "No Instantly key on this service." }, { status: 503 });
  const limits = await req.json().catch(() => ({})) as Record<string, number>;
  const api = (path: string, init: RequestInit = {}) => fetch(`https://api.instantly.ai/api/v2${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  const results: unknown[] = [];
  for (const [id, daily] of Object.entries(limits)) {
    if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(daily) || daily < 1 || daily > 300) { results.push({ id, error: "bad input" }); continue; }
    const c = await api(`/campaigns/${id}`).then((r) => r.json()) as Record<string, any>;
    const schedule = { ...c.campaign_schedule, schedules: (c.campaign_schedule?.schedules ?? []).map((s: any) => ({ ...s, days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false } })) };
    const up = await api(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify({ daily_limit: daily, campaign_schedule: schedule }) });
    const after = up.ok ? await up.json() as Record<string, any> : null;
    results.push({ id, ok: up.ok, status: up.status, daily_limit: after?.daily_limit, days: after?.campaign_schedule?.schedules?.[0]?.days, error: up.ok ? undefined : (await up.text()).slice(0, 200) });
  }
  // Per-address limits and warm-up state, so the campaign limit is actually reachable.
  const first = await api(`/campaigns/${Object.keys(limits)[0]}`).then((r) => r.json()).catch(() => null) as Record<string, any> | null;
  const accounts = [];
  for (const email of first?.email_list ?? []) {
    const a = await api(`/accounts/${encodeURIComponent(email)}`).then((r) => r.ok ? r.json() : null).catch(() => null) as Record<string, any> | null;
    accounts.push({ email, daily_limit: a?.daily_limit, warmup_status: a?.warmup_status, status: a?.status, warmup_score: a?.stat_warmup_score });
  }
  return Response.json({ results, accounts });
}
