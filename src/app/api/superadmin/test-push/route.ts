// Superadmin only: send a test push notification to your own phones, and see how it went.
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { enqueue, runPushNotifications } from "../../../../lib/push";

export const dynamic = "force-dynamic";

async function status(userId: string) {
  const devices = await db.pushDevice.findMany({ where: { userId, expiresAt: { gt: new Date() } }, select: { id: true, platform: true, createdAt: true } });
  const deliveries = await db.pushDelivery.findMany({
    where: { deviceId: { in: devices.map((d) => d.id) }, eventKey: { startsWith: "test:" } },
    orderBy: { createdAt: "desc" }, take: 6,
    select: { eventKey: true, state: true, error: true, createdAt: true, deviceId: true },
  });
  return { devices: devices.map((d) => ({ platform: d.platform, since: d.createdAt })), deliveries };
}

// ?email= targets another account (e.g. the owner's own phone account); default is yourself.
async function target(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPERADMIN") return null;
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return { id: user.id };
  return (await db.user.findUnique({ where: { email }, select: { id: true } })) ?? { id: "", missing: true };
}

export async function GET(req: Request) {
  const t = await target(req);
  if (!t) return new Response("Not found", { status: 404 });
  if ("missing" in t) return Response.json({ error: "No account with that e-mail in this region." }, { status: 404 });
  return Response.json(await status(t.id));
}

export async function POST(req: Request) {
  const t = await target(req);
  if (!t) return new Response("Not found", { status: 404 });
  if ("missing" in t) return Response.json({ error: "No account with that e-mail in this region." }, { status: 404 });
  const user = { id: t.id };
  await enqueue(user.id, `test:${Date.now()}`, "messages", "RacketBuddy", "Test: notifications work on this phone.", { kind: "test" }, new Date(Date.now() + 15 * 60_000));
  const run = await runPushNotifications();
  return Response.json({ ...run, ...(await status(user.id)) });
}
