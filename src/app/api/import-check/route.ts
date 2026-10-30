// The free import check on /switch: a club uploads its member export before
// paying and sees what will move. The list is kept (encrypted, 14 days) so it
// imports with one click after payment; nothing else happens with it.
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { parseTable, planImport } from "../../../lib/member-import";
import { DRAFT_COOKIE, saveDraft } from "../../../lib/member-import-server";

export const dynamic = "force-dynamic";
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 15) return NextResponse.json({ error: "Too many checks from this connection. Try again in an hour." }, { status: 429 });
  recent.push(now); hits.set(ip, recent); if (hits.size > 5000) hits.clear();

  const body = await req.json().catch(() => ({}));
  try {
    const plan = planImport(parseTable(String(body.text ?? "")));
    if (!plan.members.length) throw Error("We couldn't find any valid e-mail addresses in the file.");
    const token = await saveDraft(plan, String(body.source ?? "Upload"));
    (await cookies()).set(DRAFT_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 14 * 86_400, path: "/" });
    return NextResponse.json({
      rows: plan.rows, members: plan.members.length, missingEmail: plan.missingEmail, invalidEmail: plan.invalidEmail, duplicates: plan.duplicates,
      columns: plan.columns, memberships: plan.memberships, withPhone: plan.members.filter((m) => m.phone).length,
      sample: plan.members.slice(0, 5).map((m) => ({ name: m.name, email: m.email, membership: m.membership })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The file couldn't be read." }, { status: 400 });
  }
}
