// Club admin: import members (from an upload or the saved import check) and
// invite them. JSON in, JSON out.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../../lib/session";
import { parseTable, planImport } from "../../../lib/member-import";
import { DRAFT_COOKIE, deleteDraft, importMembers, inviteMembers, loadDraft } from "../../../lib/member-import-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "CLUB_ADMIN" || !user.clubId) return NextResponse.json({ error: "Only the club's administrator can do this." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const intent = String(body.intent ?? "");
  try {
    if (intent === "invite") {
      const r = await inviteMembers(user.clubId);
      const later = r.later ? ` The other ${r.later.toLocaleString("en-US")} go out automatically over the next days.` : "";
      if (r.sent === 0 && r.later) { revalidatePath("/admin", "layout"); return NextResponse.json({ ok: `Invitations are queued and go out automatically over the next days (${r.later.toLocaleString("en-US")} members).`, ...r }); }
      if (r.sent === 0 && r.pending > 0) return NextResponse.json({ error: "The invitations couldn't be sent right now. Try again in a few minutes." }, { status: 502 });
      revalidatePath("/admin", "layout");
      return NextResponse.json({ ok: r.sent ? `Invitations sent to ${r.sent.toLocaleString("en-US")} members.${later}` : r.total ? "Everyone has already been invited or has signed in." : "There are no members to invite yet." , ...r });
    }
    const jar = await cookies();
    const draftToken = jar.get(DRAFT_COOKIE)?.value;
    let members;
    if (intent === "draft") {
      const draft = await loadDraft(draftToken);
      if (!draft) return NextResponse.json({ error: "The saved list has expired. Upload the file again." }, { status: 404 });
      members = draft.members;
    } else {
      const plan = planImport(parseTable(String(body.text ?? "")));
      if (intent === "preview") return NextResponse.json({ preview: { rows: plan.rows, members: plan.members.length, missingEmail: plan.missingEmail, invalidEmail: plan.invalidEmail, duplicates: plan.duplicates, columns: plan.columns, memberships: plan.memberships, sample: plan.members.slice(0, 5) } });
      members = plan.members;
    }
    const r = await importMembers(user.clubId, members);
    if (intent === "draft" && draftToken) { await deleteDraft(draftToken); jar.delete(DRAFT_COOKIE); }
    revalidatePath("/admin", "layout");
    return NextResponse.json({ ok: `${r.created} members added${r.linked ? `, ${r.linked} existing RacketBuddy players linked` : ""}${r.already ? `, ${r.already} were already in the club` : ""}${r.elsewhere ? `, ${r.elsewhere} skipped (they belong to another club)` : ""}.`, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The import failed." }, { status: 400 });
  }
}
