// Godkendelse af klubber.
//
// Klubber oprettes selv, men bliver først synlige når en af os har set dem
// efter i sømmene. En klub der påstår at have baner, den ikke har, koster
// os tilliden hos alle andre — og hos den gæst der står foran en låst låge.
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { approveClub, rejectClub } from "../../lib/actions";
import { sportLabel } from "../../lib/sports";

export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Ikke adgang</p>
        <p className="mt-1 text-sm text-net/60">
          Denne side er for RacketBuddys egne administratorer.
        </p>
      </div>
    );
  }

  const [pending, decided] = await Promise.all([
    db.club.findMany({
      where: { status: "PENDING" },
      include: { courts: true, members: true },
      orderBy: { createdAt: "asc" },
    }),
    db.club.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-3xl">Klubgodkendelser</h1>
        <p className="text-net/70">
          {pending.length} venter · {decided.length} behandlet
        </p>
      </div>

      <section>
        <h2 className="display mb-3 text-2xl">Venter på svar</h2>
        {pending.length === 0 && (
          <p className="text-net/60">Ingen klubber venter lige nu.</p>
        )}

        <ul className="space-y-4">
          {pending.map((club: any) => {
            const admin = club.members.find((m: any) => m.role === "CLUB_ADMIN");
            const sports = Array.from(
              new Set(club.courts.map((c: any) => c.sport))
            ) as string[];

            return (
              <li key={club.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-bold">{club.name}</p>
                  <p className="text-sm text-net/50">
                    Oprettet {format(club.createdAt, "d. MMM yyyy", { locale: da })}
                  </p>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-net/50">Adresse</dt>
                    <dd>{club.address ? `${club.address}, ${club.city}` : club.city}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-net/50">Baner</dt>
                    <dd>
                      {club.courts.length} ·{" "}
                      {sports.map((s) => sportLabel(s, "da")).join(", ")}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-net/50">Pris</dt>
                    <dd>{club.priceHour} kr/time</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-net/50">Model</dt>
                    <dd>
                      {club.billingModel === "SUBSCRIPTION"
                        ? `Abonnement ${club.subscriptionKr} kr/md`
                        : "10% provision"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-net/50">System</dt>
                    <dd>{club.externalSystem ?? "ikke oplyst"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-net/50">Kontakt</dt>
                    <dd>
                      {admin ? `${admin.name} · ${admin.email}` : "ingen admin"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs text-net/50">
                  Tjek at klubben findes, at adressen passer, og at kontaktpersonen
                  hører til klubben — helst med et opkald.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={approveClub}>
                    <input type="hidden" name="id" value={club.id} />
                    <button className="btn-bane">Godkend</button>
                  </form>
                  <form action={rejectClub} className="flex flex-1 gap-2">
                    <input type="hidden" name="id" value={club.id} />
                    <input
                      className="input flex-1"
                      name="note"
                      placeholder="Intern note (valgfri)"
                    />
                    <button className="btn-ghost">Afvis</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Behandlet</h2>
        <ul className="card divide-y divide-net/10">
          {decided.map((club: any) => (
            <li key={club.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="font-semibold">{club.name}</span>
              <span className="text-net/60">{club.city}</span>
              <span
                className={
                  club.status === "APPROVED" ? "text-bane font-bold" : "text-grus font-bold"
                }
              >
                {club.status === "APPROVED" ? "Godkendt" : "Afvist"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
