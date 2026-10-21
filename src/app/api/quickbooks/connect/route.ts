// Sends the club admin to Intuit to approve the connection.
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/session";
import { authorizeUrl, quickBooksConfigured } from "../../../../lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLUB_ADMIN" || !user.clubId) return new Response("Forbidden", { status: 403 });
  if (!quickBooksConfigured()) redirect("/admin/rapporter?quickbooks=not-configured");
  redirect(await authorizeUrl(user.clubId));
}
