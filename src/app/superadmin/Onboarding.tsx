// Hvor langt hver selvbetjent klub er kommet: betalt → medlemmer → Stripe →
// planer → inviteret → første booking. Den røde kolonne er der, hvor klubben
// sidder fast.
import Link from "next/link";
import { db } from "../../lib/db";

export async function Onboarding() {
  const clubs = await db.club.findMany({
    where: { signupManaged: true },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, city: true, status: true, createdAt: true, signupPaidAt: true, stripeChargesEnabled: true, contactEmail: true, slug: true },
  });
  if (!clubs.length) return <p className="card text-slate">Ingen selvbetjente klubber endnu.</p>;
  const ids = clubs.map((c) => c.id);
  const [members, plans, bookings, invited, imported] = await Promise.all([
    db.user.groupBy({ by: ["clubId"], where: { clubId: { in: ids }, role: "PLAYER" }, _count: { _all: true } }),
    db.membershipType.groupBy({ by: ["clubId"], where: { clubId: { in: ids } }, _count: { _all: true } }),
    db.booking.groupBy({ by: ["courtId"], where: { court: { clubId: { in: ids } }, status: "CONFIRMED" }, _count: { _all: true } }).then(async (rows) => {
      const courts = await db.court.findMany({ where: { id: { in: rows.map((r) => r.courtId).filter((x): x is string => Boolean(x)) } }, select: { id: true, clubId: true } });
      const byClub = new Map<string, number>();
      for (const r of rows) { const c = courts.find((x) => x.id === r.courtId); if (c) byClub.set(c.clubId, (byClub.get(c.clubId) ?? 0) + r._count._all); }
      return byClub;
    }),
    db.platformSetting.findMany({ where: { key: { in: ids.map((id) => `club:invited:${id}`) } } }),
    db.platformSetting.findMany({ where: { key: { in: ids.map((id) => `club:imported:${id}`) } } }),
  ]);
  const count = (rows: { clubId: string | null; _count: { _all: number } }[], id: string) => rows.find((r) => r.clubId === id)?._count._all ?? 0;
  const rows = clubs.map((c) => {
    const inv = invited.find((r) => r.key === `club:invited:${c.id}`);
    const steps = [
      { label: "Betalt", ok: Boolean(c.signupPaidAt), v: c.signupPaidAt ? c.signupPaidAt.toLocaleDateString("da-DK") : "–" },
      { label: "Godkendt", ok: c.status === "APPROVED", v: c.status === "APPROVED" ? "ja" : c.status === "PENDING" ? "venter" : "afvist" },
      { label: "Medlemmer", ok: count(members, c.id) > 0, v: String(count(members, c.id)) },
      { label: "Stripe", ok: c.stripeChargesEnabled, v: c.stripeChargesEnabled ? "ja" : "nej" },
      { label: "Planer", ok: count(plans, c.id) > 0, v: String(count(plans, c.id)) },
      { label: "Inviteret", ok: Boolean(inv), v: inv ? String((JSON.parse(inv.value) as string[]).length) : "0" },
      { label: "Bookinger", ok: (bookings.get(c.id) ?? 0) > 0, v: String(bookings.get(c.id) ?? 0) },
    ];
    const stuck = steps.findIndex((s) => !s.ok);
    return { c, steps, stuck, imported: imported.some((r) => r.key === `club:imported:${c.id}`) };
  });
  const live = rows.filter((r) => r.stuck === -1).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-slate">Klubber i gang</p><p className="display text-3xl">{rows.length - live}</p></div>
        <div className="card"><p className="text-sm text-slate">Helt i luften</p><p className="display text-3xl">{live}</p></div>
        <div className="card"><p className="text-sm text-slate">Har importeret medlemmer</p><p className="display text-3xl">{rows.filter((r) => r.imported).length}</p></div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-slate"><tr><th className="px-4 py-3">Klub</th>{rows[0].steps.map((s) => <th key={s.label} className="px-3 py-3">{s.label}</th>)}<th className="px-4 py-3">Sidder fast ved</th></tr></thead>
          <tbody>
            {rows.map(({ c, steps, stuck }) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="px-4 py-3"><Link href={`/clubs/${c.slug}`} className="font-semibold underline">{c.name}</Link><p className="text-xs text-slate">{c.city} · {c.contactEmail ?? ""} · oprettet {c.createdAt.toLocaleDateString("da-DK")}</p></td>
                {steps.map((s, i) => <td key={s.label} className={`px-3 py-3 ${s.ok ? "text-success" : i === stuck ? "font-bold text-danger" : "text-slate"}`}>{s.ok ? "✓ " : ""}{s.v}</td>)}
                <td className="px-4 py-3">{stuck === -1 ? <span className="text-success">I luften</span> : <span className="font-semibold">{steps[stuck].label}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate">Opdateres ved hver visning. Klubberne ser selv den samme tjekliste øverst i deres admin.</p>
    </div>
  );
}
