// Polled by the register while a card is being taken on the reader.
import { getCurrentUser } from "../../../../lib/session";
import { readerSaleStatus } from "../../../../lib/terminal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLUB_ADMIN" || !user.clubId) return new Response("Forbidden", { status: 403 });
  const saleId = new URL(req.url).searchParams.get("sale") ?? "";
  const r = await readerSaleStatus(user.clubId, saleId).catch((e) => ({ status: "PENDING" as const, detail: e instanceof Error ? e.message : "error" }));
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
