// Intuit sends the admin back here with a code. We swap it for tokens and
// land them on the reports page.
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/session";
import { clubFromState, connectQuickBooks } from "../../../../lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code"), realmId = url.searchParams.get("realmId"), state = url.searchParams.get("state") ?? "";
  const clubId = clubFromState(state);
  const user = await getCurrentUser();
  if (!clubId || !user || user.role !== "CLUB_ADMIN" || user.clubId !== clubId) redirect("/admin/rapporter?quickbooks=denied");
  if (!code || !realmId) redirect("/admin/rapporter?quickbooks=cancelled");
  try {
    await connectQuickBooks(clubId!, code!, realmId!);
  } catch (e) {
    console.error("QuickBooks connect failed:", e);
    redirect(`/admin/rapporter?quickbooks=error&detail=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 160) : "error")}`);
  }
  redirect("/admin/rapporter?quickbooks=connected");
}
