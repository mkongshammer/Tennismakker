import { confirmInterest } from "../../../../../lib/market-interest";
import { linkPage } from "../_page";

export const dynamic = "force-dynamic";

/** GET /api/v1/market-interest/confirm?id=…&token=… — from the confirmation e-mail. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const outcome = await confirmInterest(url.searchParams.get("id") ?? "", url.searchParams.get("token") ?? "");
  if (outcome === "invalid") return linkPage("This link is not valid", "It may have been used already or copied incompletely. Search for courts again and submit the form to get a fresh link.", 400);
  if (outcome === "already") return linkPage("You’re already confirmed", "We’ll send one email when courts or coaches open near the place you asked about.");
  return linkPage("Confirmed", "Thanks. We’ll send one email when courts or coaches open near the place you asked about — nothing else.");
}
