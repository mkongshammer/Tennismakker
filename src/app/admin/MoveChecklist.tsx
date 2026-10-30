// "Move your club" checklist on the admin overview: the few things between a
// paid signup and a club its members actually use. Disappears when done.
import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "../../lib/db";
import { DRAFT_COOKIE, loadDraft } from "../../lib/member-import-server";
import { InviteMembersButton, MemberImport } from "./MemberImport";

export async function onboardingState(club: { id: string; stripeChargesEnabled: boolean; status: string }) {
  const [members, pendingInvites, invitedRow, plans, bookings] = await Promise.all([
    db.user.count({ where: { clubId: club.id, role: "PLAYER" } }),
    db.user.count({ where: { clubId: club.id, role: "PLAYER", NOT: { passwordHash: { startsWith: "$2" } } } }),
    db.platformSetting.findUnique({ where: { key: `club:invited:${club.id}` } }),
    db.membershipType.count({ where: { clubId: club.id } }),
    db.booking.count({ where: { court: { clubId: club.id }, status: "CONFIRMED" } }),
  ]);
  const invited = invitedRow ? (JSON.parse(invitedRow.value) as string[]).length : 0;
  return { members, pendingInvites: Math.max(0, pendingInvites - invited), invited, plans, bookings, stripe: club.stripeChargesEnabled, approved: club.status === "APPROVED" };
}

export async function MoveChecklist({ club }: { club: { id: string; slug: string; name: string; stripeChargesEnabled: boolean; status: string } }) {
  const s = await onboardingState(club);
  const draft = await loadDraft((await cookies()).get(DRAFT_COOKIE)?.value);
  const steps = [
    { done: s.members > 0, title: "Bring your members", body: s.members ? `${s.members.toLocaleString("en-US")} members in the club.` : "Upload the member list from your old system, as it is." },
    { done: s.stripe, title: "Connect Stripe", body: s.stripe ? "Payments go straight to your bank." : "So members and guests can pay you online. Takes about 5 minutes with Stripe." },
    { done: s.plans > 0, title: "Add your membership plans", body: s.plans ? `${s.plans} plan${s.plans === 1 ? "" : "s"} set up.` : "Monthly, annual or family plans that members pay online." },
    { done: s.members > 0 && s.pendingInvites === 0 && s.invited > 0, title: "Invite your members", body: s.invited ? `${s.invited.toLocaleString("en-US")} invited.` : "One e-mail with a link to set their password and get the app." },
    { done: s.bookings > 0, title: "Take your first booking", body: s.approved ? "Share your booking page with members." : "Your page goes public as soon as RacketBuddy has reviewed the club (usually within a day)." },
  ];
  const left = steps.filter((x) => !x.done);
  if (!left.length && !draft) return null;
  const pct = Math.round(((steps.length - left.length) / steps.length) * 100);
  const current = steps.findIndex((x) => !x.done);
  return (
    <section className="card space-y-5" aria-labelledby="move-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow text-court-light">Getting started</p><h2 id="move-title" className="display text-2xl">Move {club.name} to RacketBuddy</h2></div>
        <p className="text-sm text-slate">{steps.length - left.length} of {steps.length} done</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-optic" style={{ width: `${pct}%` }} /></div>
      <ol className="space-y-3">
        {steps.map((x, i) => (
          <li key={x.title} className={`rounded-2xl border p-4 ${i === current ? "border-court-light/60 bg-court-tint/30" : "border-white/10"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${x.done ? "bg-success text-ink" : "bg-white/10"}`}>{x.done ? "✓" : i + 1}</span>
              <div className="min-w-0 flex-1 space-y-3">
                <div><p className="font-bold">{x.title}</p><p className="text-sm text-slate">{x.body}</p></div>
                {i === 0 && (!x.done || draft) && <MemberImport draftCount={draft?.members.length ?? 0} draftSource={draft?.source} />}
                {i === 1 && !x.done && <Link href="/admin/betaling" className="btn-court inline-flex">Connect Stripe</Link>}
                {i === 2 && !x.done && <Link href="/admin/medlemmer" className="btn-ghost inline-flex">Add a plan</Link>}
                {i === 3 && s.members > 0 && !x.done && <InviteMembersButton pending={s.pendingInvites} />}
                {i === 4 && s.approved && <Link href={`/clubs/${club.slug}`} className="btn-ghost inline-flex">Open your booking page</Link>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
