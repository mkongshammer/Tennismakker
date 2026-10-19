import { unsubscribeInterest } from "../../../../../lib/market-interest";
import { linkPage } from "../_page";

export const dynamic = "force-dynamic";

/** GET /api/v1/market-interest/unsubscribe?id=…&token=… — removes the row entirely. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ok = await unsubscribeInterest(url.searchParams.get("id") ?? "", url.searchParams.get("token") ?? "");
  if (!ok) return linkPage("This link is not valid", "It may have been used already. If you still receive email from us about an area, reply to it and we will remove you by hand.", 400);
  return linkPage("You’re unsubscribed", "Your email address has been removed from this notification. Nothing else was kept.");
}
