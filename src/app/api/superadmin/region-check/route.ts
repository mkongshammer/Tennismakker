// Superadmin: is the US service ready to run without the EU service?
import { getCurrentUser } from "../../../../lib/session";
import { usStandaloneStatus, copySharedConfigToUS } from "../../../../lib/us-standalone";
import { regionalInternalHeaders } from "../../../../lib/internal-auth";

export const dynamic = "force-dynamic";

async function euSummary() {
  const origin = process.env.REGIONAL_SETTINGS_ORIGIN || process.env.EU_APP_URL;
  if (!origin) return { error: "no EU origin configured" };
  try {
    const r = await fetch(new URL("/api/internal/legacy-summary", origin), { headers: regionalInternalHeaders(), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { error: `EU returned ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "failed" };
  }
}

export async function GET(req: Request) {
  if ((await getCurrentUser())?.role !== "SUPERADMIN") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const copy = url.searchParams.get("action") === "copy" ? await copySharedConfigToUS() : undefined;
  const [status, eu] = await Promise.all([usStandaloneStatus(), euSummary()]);
  return Response.json({ copy, status, eu, env: { regionalShardingActive: process.env.REGIONAL_SHARDING_ACTIVE, euAppUrl: process.env.EU_APP_URL ?? null, settingsOrigin: process.env.REGIONAL_SETTINGS_ORIGIN ?? null, appUrl: process.env.APP_URL ?? null } });
}
