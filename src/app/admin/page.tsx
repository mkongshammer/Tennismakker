// Klub-administration: her styrer klubben, hvordan RacketBuddy henter
// ledighed, og hvilke tider udefrakommende spillere må booke.
import { redirect } from "next/navigation";
import { addDays, format, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { markClubEntered, syncNow, withdrawGuestSlot, toggleRule, deleteRule, setLastMinute, generateJoinCode, deletePost, setTheme, startClubSubscription, openClubBillingPortal } from "../../lib/actions";
import { INTEGRATION_LABELS } from "../../lib/integrations/types";
import { SURFACES } from "../../lib/levels";
import { IntegrationForm } from "./IntegrationForm";
import { ReleaseForm } from "./ReleaseForm";
import { RuleForm } from "./RuleForm";
import { SiteForm, PostForm } from "./SiteForm";
import { ImageForms } from "./ImageForms";
import { startClubPayoutSetup } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { refreshAccountStatus } from "../../lib/connect";
import { stripeEnabled } from "../../lib/stripe";
import { getSettings } from "../../lib/settings";
import { subscriptionIsActive } from "../../lib/billing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { stripe?: string; abonnement?: string };
}) {
  const user = await getCurrentUser();
  const stripeOn = await stripeEnabled();
  const pct = Math.round((await getSettings()).commissionPct * 100);
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

  if (searchParams.stripe === "return" || searchParams.stripe === "refresh") {
    const admin = await getCurrentUser();
    if (admin?.clubId) await refreshAccountStatus("CLUB", admin.clubId).catch(() => null);
  }

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    include: {
      courts: { orderBy: { name: "asc" } },
      members: true,
      posts: { orderBy: { createdAt: "desc" }, take: 10 },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!club) redirect("/");

  const courtIds = club.courts.map((c: any) => c.id);
  const today = startOfDay(new Date());

  const [upcoming, payments, rules, guestSlots] = await Promise.all([
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
    db.guestRule.findMany({ where: { clubId: club.id }, orderBy: { createdAt: "desc" } }),
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

      {searchParams.abonnement && (
        <p className="card border border-court/25 text-sm">
          {searchParams.abonnement === "ok"
            ? "Tak — abonnementet er startet. Kvitteringen ligger i jeres indbakke."
            : searchParams.abonnement === "afbrudt"
              ? "Betalingen blev afbrudt. Abonnementet er ikke startet."
              : searchParams.abonnement === "portal"
                ? "Selvbetjeningen kunne ikke åbnes lige nu. Skriv til os, så ordner vi det."
                : "Abonnementet kunne ikke startes lige nu. Prøv igen, eller skriv til os."}
        </p>
      )}

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

      {stripeOn && (
        <section className="card">
          <p className="display text-xl">Udbetalinger</p>
          {club.stripeChargesEnabled ? (
            <p className="mt-2 text-sm">
              <span className="font-bold text-court">Aktivt.</span> Gæster kan betale,
              og pengene sendes automatisk til jeres konto minus vores andel.
            </p>
          ) : (
            <>
              <p className="mt-2 rounded-xl border border-court/30 bg-court/5 p-3 text-sm font-semibold">
                Gæster kan ikke booke hos jer endnu. Jeres tider vises, men en
                booking afvises, indtil dette er på plads.
              </p>
              <p className="mt-2 text-sm text-slate">
                Klubben skal have en Stripe-konto, før gæster kan booke og betale.
                Det tager typisk 5-10 minutter — I skal bruge NemID/MitID og
                klubbens kontonummer.
              </p>
              <form action={startClubPayoutSetup} className="mt-3">
                <SubmitButton pendingText="Åbner Stripe…">
                  {club.stripeAccountId ? "Fortsæt opsætning" : "Sæt udbetalinger op"}
                </SubmitButton>
              </form>
            </>
          )}
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
        <>
          <>
            <p className="mt-2">
              <span className="font-bold">{club.subscriptionKr} kr/md.</span>{" "}
              I beholder hele beløbet for hver gæstebooking.
            </p>
            <p className="mt-1 text-sm text-slate">
              Tider kan kun frigives, mens abonnementet er aktivt. Bookinger,
              en gæst har betalt for, står ved magt uanset hvad.
            </p>
            <p className="mt-1 text-sm text-slate/60">
              Fast pris uanset hvor mange bookinger der kommer ind. Vi tager
              intet af den enkelte booking — hele beløbet går til jer.
            </p>

            {subscriptionIsActive(club) ? (
              <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court">Betaling aktiv.</span>{" "}
                  {club.subscriptionRenewsAt
                    ? `Fornyes ${format(club.subscriptionRenewsAt, "d. MMMM", { locale: da })}.`
                    : "Fornyes automatisk hver måned."}
                </p>
                <form action={openClubBillingPortal} className="mt-3">
                  <SubmitButton className="btn-ghost" pendingText="Åbner Stripe…">
                    Kort, fakturaer og opsigelse
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court-dark">
                    {club.subscriptionStatus === "past_due" || club.subscriptionStatus === "unpaid"
                      ? "Betalingen fejlede."
                      : club.subscriptionStatus === "canceled"
                        ? "Abonnementet er opsagt."
                        : "Abonnementet er ikke startet."}
                  </span>{" "}
                  Indtil det betales, trækkes {pct}% af hver gæstebooking i stedet.
                </p>
                <form action={startClubSubscription} className="mt-3">
                  <SubmitButton pendingText="Åbner Stripe…">
                    {club.stripeCustomerId ? "Forny betaling" : "Start abonnement"}
                  </SubmitButton>
                </form>
              </>
            )}
          </>
        </>
        <p className="mt-3 text-sm text-slate/60">
          Vil I skifte model, så skriv til os.
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl">Jeres side</h2>
          <Link href={`/klub/${club.slug}`} className="text-sm font-semibold text-court underline">
            Se den som gæsterne gør
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate">
          Bruger I os som jeres eneste system, er det her jeres hjemmeside.
        </p>
        <ImageForms
          logoId={club.logoId}
          heroId={club.heroId}
          photos={club.images
            .filter((i: any) => i.kind === "PHOTO")
            .map((i: any) => ({ id: i.id, alt: i.alt }))}
        />

        <div className="mt-4">
          <SiteForm club={club} />
        </div>

        <div className="card mt-4">
          <p className="font-bold">Udseende</p>
          <p className="mt-1 text-sm text-slate">
            Tre måder at vise klubben på. Skift frit — det ændrer kun
            forsiden, ikke indholdet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["KLASSISK", "Klassisk", "Farvet hoved med banemotiv"],
              ["MARKANT", "Markant", "Mørkt hoved, stort klubnavn"],
              ["ENKEL", "Enkel", "Lyst og roligt"],
            ].map(([value, label, hint]) => (
              <form action={setTheme} key={value}>
                <input type="hidden" name="theme" value={value} />
                <button
                  className={`rounded-xl border px-4 py-3 text-left ${
                    club.theme === value
                      ? "border-court bg-court/5"
                      : "border-slate/20"
                  }`}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-xs text-slate">{hint}</span>
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="card mt-4">
          <p className="font-bold">Eget domæne</p>
          {club.customDomain ? (
            <>
              <p className="data mt-1">{club.customDomain}</p>
              <p className="mt-1 text-sm text-slate">
                {club.domainStatus === "LIVE"
                  ? "Aktivt. Jeres side ligger på jeres eget domæne."
                  : "Registreret. Vi giver besked, når det er slået igennem."}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate">
                Jeres side kan ligge på klubbens eget domæne i stedet for hos
                os. Vi sætter det op for jer.
              </p>
              <Link href="/hjemmeside" className="btn-ghost mt-3">
                Læs om det
              </Link>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Medlemmer</h2>
        <p className="mb-4 text-sm text-slate">
          {club.joinCode
            ? "Del koden med jeres medlemmer, så booker de til medlemspris."
            : "Lav en kode, I kan dele med medlemmerne."}
        </p>
        <div className="card flex flex-wrap items-center justify-between gap-4">
          {club.joinCode ? (
            <p className="data text-2xl font-bold">{club.joinCode}</p>
          ) : (
            <p className="text-slate">Ingen kode endnu</p>
          )}
          <form action={generateJoinCode}>
            <button className="btn-ghost">
              {club.joinCode ? "Lav en ny kode" : "Lav en kode"}
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs text-slate">
          Laver I en ny kode, holder den gamle op med at virke. Medlemmer der
          allerede er meldt ind, bliver ved med at være det.
        </p>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Nyheder</h2>
        <p className="mb-4 text-sm text-slate">
          Vises øverst på jeres side. Til lukkedage, turneringer og andet, folk
          skal vide.
        </p>
        <PostForm />

        {club.posts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {club.posts.map((post: any) => (
              <li key={post.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {post.pinned && <span className="text-court">★ </span>}
                    {post.title}
                  </p>
                  <p className="text-xs text-slate">
                    {format(post.createdAt, "d. MMMM yyyy", { locale: da })}
                  </p>
                </div>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className="text-sm text-slate underline">Slet</button>
                </form>
              </li>
            ))}
          </ul>
        )}
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
              afsæt en bane til hver. Så kan den samme time ikke sælges to gange.
            </p>
            <p className="mt-2 text-slate/70">
              Tag altid tiden ud af jeres eget system, når I frigiver den her.
            </p>
          </div>
          <RuleForm
            courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
            defaultPrice={club.priceHour}
            externalSystem={club.externalSystem ?? "jeres eget bookingsystem"}
          />

          {rules.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 font-bold">Jeres regler</h3>
              <ul className="space-y-2">
                {rules.map((r: any) => {
                  const dayNames = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
                  const days = r.daysOfWeek
                    .split(",")
                    .map((d: string) => dayNames[Number(d)])
                    .join(", ");
                  const courtNames = r.courtIds
                    ? r.courtIds
                        .split(",")
                        .map((id: string) => club.courts.find((c: any) => c.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")
                    : "alle baner";
                  return (
                    <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className={`font-semibold ${r.active ? "" : "text-slate line-through"}`}>
                          {days} · {r.fromHour}–{r.toHour} · {courtNames}
                        </p>
                        <p className="data text-sm text-slate">{r.priceKr} kr/time</p>
                      </div>
                      <div className="flex gap-2">
                        <form action={toggleRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm font-semibold text-court underline">
                            {r.active ? "Sæt på pause" : "Aktivér"}
                          </button>
                        </form>
                        <form action={deleteRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm text-slate underline">Slet</button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="card mt-6">
            <p className="font-bold">Sidste øjeblik</p>
            <p className="mt-1 text-sm text-slate">
              Frigiv automatisk alt, der stadig står tomt tæt på spilletidspunktet.
              En bane der er ledig om en time er tabt indtægt uanset hvad.
            </p>
            <form action={setLastMinute} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="hours">Timer før start</label>
                <input
                  className="input w-32"
                  id="hours"
                  name="hours"
                  type="number"
                  min={0}
                  max={72}
                  defaultValue={club.lastMinuteHours}
                />
              </div>
              <button className="btn-ghost">Gem</button>
            </form>
            <p className="mt-2 text-xs text-slate">0 slår det fra.</p>
          </div>

          <h3 className="mb-2 mt-6 font-bold">Enkelte tider</h3>
          <p className="mb-3 text-sm text-slate">
            Til undtagelser — en enkelt aften der alligevel blev fri.
          </p>
          <ReleaseForm
            courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
            defaultPrice={club.priceHour}
            externalSystem={club.externalSystem ?? "jeres eget bookingsystem"}
          />

          <h3 className="mb-2 mt-6 font-bold">Frigivne enkelttider</h3>
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
