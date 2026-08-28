// Klub-admin dashboard (Modul C, admin-delen):
// overblik over dagens bookinger, baner, medlemmer og omsætning.
import { redirect } from "next/navigation";
import { addDays, format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { SURFACES } from "@/lib/levels";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Kun for klub-administratorer</p>
        <p className="mt-1 text-sm text-net/60">
          Din konto er ikke tilknyttet en klub. Kontakt Tennis Makker for at få jeres klub med.
        </p>
      </div>
    );
  }

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    include: { courts: true, members: true },
  });
  if (!club) redirect("/");

  const today = startOfDay(new Date());
  const [todaysBookings, payments] = await Promise.all([
    db.booking.findMany({
      where: {
        courtId: { in: club.courts.map((c) => c.id) },
        status: "CONFIRMED",
        startsAt: { gte: today, lt: addDays(today, 1) },
      },
      include: { user: true, court: true },
      orderBy: { startsAt: "asc" },
    }),
    db.payment.findMany({
      where: {
        status: "PAID",
        booking: { courtId: { in: club.courts.map((c) => c.id) } },
      },
    }),
  ]);

  const gross = payments.reduce((s, p) => s + p.amountKr, 0);
  const fees = payments.reduce((s, p) => s + p.platformFee, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-3xl">{club.name} — administration</h1>
        <p className="text-net/70">Klubside: /klub/{club.slug}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="card"><p className="text-sm text-net/60">Baner</p><p className="display text-3xl">{club.courts.length}</p></div>
        <div className="card"><p className="text-sm text-net/60">Medlemmer</p><p className="display text-3xl">{club.members.length}</p></div>
        <div className="card"><p className="text-sm text-net/60">Omsætning (baner)</p><p className="display text-3xl">{gross} kr</p></div>
        <div className="card"><p className="text-sm text-net/60">Udbetales til klubben</p><p className="display text-3xl text-bane">{gross - fees} kr</p></div>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Dagens bookinger</h2>
        {todaysBookings.length === 0 && <p className="text-net/60">Ingen bekræftede bookinger i dag.</p>}
        <ul className="space-y-2">
          {todaysBookings.map((b) => (
            <li key={b.id} className="card flex flex-wrap justify-between gap-2 py-3">
              <span className="font-semibold">
                {format(b.startsAt, "HH:mm", { locale: da })}–{format(b.endsAt, "HH:mm")} · {b.court?.name}
              </span>
              <span>{b.user.name}</span>
              <span className="text-net/60">{b.priceKr} kr</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Baner</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {club.courts.map((c) => (
            <li key={c.id} className="card py-3">
              <p className="font-bold">{c.name}</p>
              <p className="text-sm text-net/60">{SURFACES[c.surface] ?? c.surface}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Medlemmer</h2>
        <ul className="card divide-y divide-net/10">
          {club.members.map((m) => (
            <li key={m.id} className="flex justify-between py-2 text-sm">
              <span className="font-semibold">{m.name}</span>
              <span className="text-net/60">{m.email}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
