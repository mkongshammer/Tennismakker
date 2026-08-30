// Klub-administration: her styrer klubben, hvordan RacketBuddy henter
// ledighed, og hvilke tider udefrakommende spillere må booke.
import { redirect } from "next/navigation";
import { addDays, format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { markClubEntered, syncNow, withdrawGuestSlot } from "../../lib/actions";
import { INTEGRATION_LABELS } from "../../lib/integrations/types";
import { SURFACES } from "../../lib/levels";
import { IntegrationForm } from "./IntegrationForm";
import { ReleaseForm } from "./ReleaseForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Kun for klub-administratorer</p>
        <p className="mt-1 text-sm text-slate/60">
          Din konto er ikke tilknyttet en klub. Kontakt RacketBuddy for at få jeres klub med.
        </p>
      </div>
    );
  }

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    include: { courts: { orderBy: { name: "asc" } }, members: true },
  });
  if (!club) redirect("/");

  const courtIds = club.courts.map((c: any) => c.id);
  const today = startOfDay(new Date());

  const [upcoming, payments, guestSlots] = await Promise.all([
    db.booking.findMany({
      where: {
        courtId: { in: courtIds },
        status: "CONFIRMED",
        startsAt: { gte: today, lt: addDays(today, 8) },
      },
      include: { user: true, court: true },
      orderBy: { startsAt: "asc" },
    }),
    db.payment.findMany({
      where: { status: "PAID", booking: { courtId: { in: courtIds } } },
    }),
    db.guestSlot.findMany({
      where: { courtId: { in: courtIds }, startsAt: { gte: new Date() } },
      include: { court: true },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
  ]);

  const gross = payments.reduce((s: number, p: any) => s + p.amountKr, 0);
  const fees = payments.reduce((s: number, p: any) => s + p.platformFee, 0);
  const toEnter = upcoming.filter((b: any) => b.needsClubEntry && !b.clubEnteredAt);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-3xl">{club.name}</h1>
        <p className="text-slate/70">
          Klubside: /klub/{club.slug} · {INTEGRATION_LABELS[club.integrationType as keyof typeof INTEGRATION_LABELS]}
        </p>
      </div>

      {toEnter.length > 0 && (
        <section className="rounded-lg border-2 border-court bg-court/5 p-5">
          <p className="display text-xl text-court-dark">
            {toEnter.length} booking{toEnter.length === 1 ? "" : "er"} skal ind i jeres eget system
          </p>
          <p className="mt-1 text-sm">
            Gæsten har betalt hos os. Før tiden ind i {club.externalSystem || "klubbens bookingsystem"},
            så banen ikke bliver dobbeltbooket.
          </p>
          <ul className="mt-4 space-y-2">
            {toEnter.map((b: any) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3">
                <span className="text-sm">
                  <span className="font-bold capitalize">
                    {format(b.startsAt, "EEE d/M 'kl.' HH:mm", { locale: da })}
                  </span>{" "}
                  · {b.court?.name} · {b.user.name}
                </span>
                <form action={markClubEntered}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-ink text-sm">Ført ind</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate/60">Baner</p>
          <p className="display text-3xl">{club.courts.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">Gæstebookinger</p>
          <p className="display text-3xl">{payments.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">Omsætning</p>
          <p className="display text-3xl">{gross} kr</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">Udbetalt til jer</p>
          <p className="display text-3xl text-ink">{gross - fees} kr</p>
        </div>
      </section>

      <section className="card">
        <p className="display text-xl">Jeres aftale</p>
        {club.billingModel === "SUBSCRIPTION" ? (
          <>
            <p className="mt-2">
              <span className="font-bold">Abonnement — {club.subscriptionKr} kr/md.</span>{" "}
              I beholder hele beløbet for hver gæstebooking.
            </p>
            <p className="mt-1 text-sm text-slate/60">
              Fast pris uanset hvor mange bookinger der kommer ind. Bedst når I
              har mange ledige tider at fylde.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2">
              <span className="font-bold">Provision — 10% af hver gæstebooking.</span>{" "}
              Ingen fast betaling.
            </p>
            <p className="mt-1 text-sm text-slate/60">
              I betaler kun, når I tjener penge. Kommer der ingen bookinger,
              koster det jer ingenting.
            </p>
          </>
        )}
        <p className="mt-3 text-sm text-slate/60">
          Vil I skifte model, så skriv til os.
        </p>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Sådan finder vi jeres ledige tider</h2>
        <p className="mb-4 text-sm text-slate/60">
          I beholder jeres eget bookingsystem. Vælg hvordan vi skal vide, hvad der er ledigt.
        </p>
        <IntegrationForm
          integrationType={club.integrationType}
          icalUrl={club.icalUrl ?? ""}
          externalSystem={club.externalSystem ?? ""}
        />

        {club.integrationType === "ICAL" && (
          <div className="card mt-4">
            <p className="font-bold">Synkronisering</p>
            <p className="mt-1 text-sm text-slate/60">
              {club.lastSyncAt
                ? `Sidst hentet ${format(club.lastSyncAt, "d. MMMM 'kl.' HH:mm", { locale: da })}.`
                : "Feed er ikke hentet endnu."}
            </p>
            {club.lastSyncError && (
              <p className="mt-2 text-sm font-semibold text-court">{club.lastSyncError}</p>
            )}
            <form action={syncNow} className="mt-3">
              <button className="btn-ink">Synkronisér nu</button>
            </form>
          </div>
        )}
      </section>

      {club.integrationType === "MANUAL" && (
        <section>
          <h2 className="display mb-1 text-2xl">Frigiv tider til gæster</h2>
          <p className="mb-3 text-sm text-slate/60">
            Kun tider, I frigiver her, kan ses og bookes af spillere udefra.
          </p>

          <div className="mb-4 rounded-lg border border-slate/15 bg-white p-4 text-sm">
            <p className="font-bold">Sælger I også baner et andet sted?</p>
            <p className="mt-1 text-slate/70">
              Bruger I både os og en anden platform, kan vi ikke se hinandens
              bookinger. Frigiv derfor forskellige tider til hver kanal — eller
              afsæt en ink til hver. Så kan den samme time ikke sælges to gange.
            </p>
            <p className="mt-2 text-slate/70">
              Tag altid tiden ud af jeres eget system, når I frigiver den her.
            </p>
          </div>
          <ReleaseForm
            courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
            defaultPrice={club.priceHour}
          />

          <h3 className="mb-2 mt-6 font-bold">Frigivne tider</h3>
          {guestSlots.length === 0 ? (
            <p className="text-sm text-slate/60">Ingen tider er frigivet endnu.</p>
          ) : (
            <ul className="card divide-y divide-slate/10">
              {guestSlots.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="capitalize">
                    {format(s.startsAt, "EEE d/M 'kl.' HH:mm", { locale: da })} · {s.court.name} ·{" "}
                    {s.priceKr} kr
                  </span>
                  <form action={withdrawGuestSlot}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-court underline">Fjern</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="display mb-3 text-2xl">Kommende gæstebookinger</h2>
        {upcoming.length === 0 && <p className="text-slate/60">Ingen bookinger i den kommende uge.</p>}
        <ul className="space-y-2">
          {upcoming.map((b: any) => (
            <li key={b.id} className="card flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="font-semibold capitalize">
                {format(b.startsAt, "EEE d/M HH:mm", { locale: da })}–{format(b.endsAt, "HH:mm")} ·{" "}
                {b.court?.name}
              </span>
              <span>{b.user.name}</span>
              <span className="text-slate/60">
                {b.priceKr} kr
                {b.needsClubEntry && !b.clubEnteredAt && (
                  <span className="ml-2 font-bold text-court">skal føres ind</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Baner</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {club.courts.map((c: any) => (
            <li key={c.id} className="card py-3">
              <p className="font-bold">{c.name}</p>
              <p className="text-sm text-slate/60">{SURFACES[c.surface] ?? c.surface}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
