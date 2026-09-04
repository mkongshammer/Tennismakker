// Klubbens side.
//
// For klubber på NATIVE er det her deres eneste hjemmeside — så siden skal
// kunne stå alene: hvem er klubben, hvad koster det, hvordan kommer man
// ind på anlægget, og hvad sker der lige nu. Bookingen er en del af siden,
// ikke hele siden.
import { notFound } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { db } from "../lib/db";
import { getCurrentUser } from "../lib/session";
import { getPreferences } from "../lib/preferences";
import { releaseExpiredHolds } from "../lib/payments";
import { getClubAvailability } from "../lib/integrations";
import { BookingGrid } from "./BookingGrid";
import { clubRatings } from "../lib/reviews";
import { sportLabel } from "../lib/sports";
import { imageUrl } from "../lib/imageUrl";


export async function generateMetadata({ params }: { params: { slug: string } }) {
  const club = await db.club.findUnique({ where: { slug: params.slug } });
  return {
    title: club ? `${club.name} — book bane` : "Klub",
    description: club?.tagline ?? club?.about ?? undefined,
  };
}

/**
 * Klubbens side, uafhængigt af hvilken adresse man kom ind ad.
 *
 * Ligger for sig selv, fordi den vises to steder: på /klub/<slug> og på
 * klubbens eget domæne. Før omdirigerede domænet til /klub/<slug>, og så
 * stod der racketbuddy.app i adresselinjen et sekund efter — klubben havde
 * betalt for en hjemmeside, der sendte deres besøgende videre til vores.
 */
export async function ClubPage({
  slug,
  searchParams,
  ownDomain = false,
}: {
  slug: string;
  searchParams: { dag?: string; optaget?: string; fejl?: string; afvist?: string };
  /** Vises den på klubbens eget domæne? Så skjules vores egen navigation. */
  ownDomain?: boolean;
}) {
  const club = await db.club.findUnique({
    where: { slug },
    include: {
      courts: { orderBy: { name: "asc" } },
      posts: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 },
      images: { where: { kind: "PHOTO" }, orderBy: { sortOrder: "asc" }, take: 8 },
      people: { orderBy: { sortOrder: "asc" } },
      _count: { select: { members: true } },
    },
  });
  if (!club || club.status !== "APPROVED") notFound();

  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  await releaseExpiredHolds();

  const isMember = Boolean(user && user.clubId === club.id);

  const today = startOfDay(new Date());
  const dayOffset = Math.min(6, Math.max(0, Number(searchParams.dag ?? 0) || 0));
  const day = addDays(today, dayOffset);

  const [{ slots }, ratings] = await Promise.all([
    getClubAvailability(club.id, day, addDays(day, 1), { isMember }),
    clubRatings([club.id]),
  ]);
  const rating = ratings.get(club.id) ?? { average: 0, count: 0 };

  const hours: number[] = [];
  for (let h = club.openHour; h < club.closeHour; h++) hours.push(h);

  const sports = Array.from(new Set(club.courts.map((c: any) => c.sport))) as string[];

  return (
    <div className="space-y-12">
      {/* Klubbens hoved — udseendet følger klubbens valgte tema */}
      {club.theme === "MARKANT" ? (
        <section className="rounded-2xl bg-ink px-6 py-14 text-chalk sm:px-10 sm:py-20">
          <p className="eyebrow text-chalk/85">
            {sports.map((s) => sportLabel(s, prefs.locale)).join(" · ")}
          </p>
          <h1
            className="display mt-3 text-4xl leading-[0.95] sm:text-7xl"
            style={{ color: club.color }}
          >
            {club.name}
          </h1>
          {club.tagline && (
            <p className="mt-5 max-w-xl text-lg text-chalk/80">{club.tagline}</p>
          )}
          <p className="data mt-8 text-sm text-chalk/60">
            {club.address ? `${club.address}, ` : ""}
            {club.city} · {club.courts.length} baner
            {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
          </p>
        </section>
      ) : club.theme === "ENKEL" ? (
        <section className="border-b border-slate/15 pb-8">
          <div
            className="mb-5 h-1.5 w-16 rounded-full"
            style={{ backgroundColor: club.color }}
          />
          <h1 className="display text-3xl sm:text-5xl">{club.name}</h1>
          {club.tagline && (
            <p className="mt-2 max-w-xl text-lg text-slate">{club.tagline}</p>
          )}
          <p className="mt-4 text-sm text-slate">
            {club.address ? `${club.address}, ` : ""}
            {club.city} · {club.courts.length} baner
            {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
          </p>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-2xl">
          {club.heroId ? (
            <>
              {/* Klubbens eget billede. Et mørkt lag ovenpå, så teksten kan
                  læses uanset hvor lyst billedet er. */}
              <img
                src={imageUrl(club.heroId)}
                alt=""
                className="h-[300px] w-full object-cover sm:h-[420px]"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, ${club.color}f2 0%, ${club.color}99 45%, ${club.color}33 100%)`,
                }}
              />
            </>
          ) : (
            <div
              className="h-[260px] w-full sm:h-[340px]"
              style={{ backgroundColor: club.color }}
            >
              <svg
                className="h-full w-full opacity-[0.15]"
                viewBox="0 0 400 200"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <g stroke="#fff" strokeWidth="1.5" fill="none">
                  <rect x="30" y="18" width="340" height="164" />
                  <line x1="30" y1="44" x2="370" y2="44" />
                  <line x1="30" y1="156" x2="370" y2="156" />
                  <line x1="118" y1="44" x2="118" y2="156" />
                  <line x1="282" y1="44" x2="282" y2="156" />
                  <line x1="118" y1="100" x2="282" y2="100" />
                </g>
                <line x1="200" y1="8" x2="200" y2="192" stroke="#fff" strokeWidth="3" />
              </svg>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-6 text-chalk sm:p-10">
            {club.logoId && (
              <img
                src={imageUrl(club.logoId)}
                alt={`${club.name} logo`}
                className="mb-4 h-16 w-16 rounded-xl bg-chalk/95 object-contain p-1.5 sm:h-20 sm:w-20"
              />
            )}
            <p className="eyebrow text-chalk">
              {sports.map((s) => sportLabel(s, prefs.locale)).join(" · ")}
            </p>
            <h1 className="display mt-1 text-3xl drop-shadow-sm sm:text-5xl">
              {club.name}
            </h1>
            {club.tagline && (
              <p className="mt-2 max-w-xl text-lg text-chalk/90">{club.tagline}</p>
            )}
            <p className="mt-3 text-sm font-semibold text-chalk/85">
              {club.address ? `${club.address}, ` : ""}
              {club.city} · {club.courts.length} baner
              {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
            </p>
            {isMember && (
              <p className="data mt-3 inline-block rounded-full bg-chalk/20 px-3 py-1 text-sm font-bold">
                Du er medlem — medlemspris
              </p>
            )}
          </div>
        </section>
      )}

      {/* Afvist af klubbens egne regler. Beskeden kommer fra club-rules.ts
          og er skrevet til at kunne læses af den, der blev afvist. */}
      {searchParams.afvist && (
        <p className="rounded-xl border-2 border-court/30 bg-court/5 p-4 text-sm font-semibold">
          {searchParams.afvist}
        </p>
      )}

      {(searchParams.optaget || searchParams.fejl) && (
        <p className="rounded-xl border border-court/25 bg-court/5 p-4 text-sm">
          {searchParams.fejl === "betaling"
            ? "Klubben kan ikke tage imod betaling endnu, så bookingen blev ikke gennemført. Vi har givet klubben besked."
            : searchParams.fejl === "passeret"
              ? "Det tidspunkt er passeret. Vælg en anden tid."
              : "Den tid var lige taget. Her er resten af dagen — vælg en anden."}
        </p>
      )}

      {/* Nyheder fra klubben */}
      {club.posts.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Nyt fra klubben</h2>
          <ul className="space-y-3">
            {club.posts.map((post: any) => (
              <li key={post.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold">{post.title}</p>
                  <p className="text-xs text-slate">
                    {format(post.createdAt, "d. MMMM", { locale: da })}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {post.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Booking */}
      <section>
        {!club.stripeChargesEnabled && (
        <div className="mb-5 rounded-xl border border-court/30 bg-court/5 p-4">
          <p className="font-bold">Denne klub kan ikke tage imod bookinger endnu</p>
          <p className="mt-1 text-sm text-slate">
            Klubben er ved at få sin betalingsopsætning på plads. Tiderne
            nedenfor er vejledende, og en booking vil blive afvist indtil da.
          </p>
        </div>
      )}

      <h2 className="display mb-1 text-2xl">Book bane</h2>
        <p className="mb-4 text-sm text-slate">
          {club.memberPriceHour != null && !isMember
            ? `Gæstepris ${club.priceHour} kr. Medlemmer betaler ${club.memberPriceHour} kr.`
            : "Tiden holdes i 10 minutter, mens du betaler."}
        </p>

        <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(today, i);
              const active = isSameDay(d, day);
              return (
                <Link
                  key={i}
                  href={`/klub/${club.slug}?dag=${i}`}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold capitalize ${
                    active
                      ? "bg-ink text-chalk"
                      : "border border-slate/20 bg-chalk text-slate"
                  }`}
                >
                  {format(d, "EEE d/M", { locale: da })}
                </Link>
              );
            })}
          </div>
        </div>

        <BookingGrid
          courts={club.courts.map((c: any) => ({
            id: c.id,
            name: c.name,
            surface: c.surface,
            sport: c.sport,
          }))}
          slots={slots.map((s) => ({
            courtId: s.courtId,
            startsAt: s.startsAt.toISOString(),
            priceKr: s.priceKr,
          }))}
          hours={hours}
          loggedIn={Boolean(user)}
          locale={prefs.locale}
        />

        {!user && slots.length > 0 && (
          <p className="mt-4 text-sm text-slate">
            <Link href="/login" className="font-semibold text-court underline">
              Log ind
            </Link>{" "}
            for at booke en bane.
          </p>
        )}
      </section>

      {/* Praktisk og om */}
      {(club.about || club.practicalInfo) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {club.about && (
            <div className="card">
              <h2 className="display text-xl">Om klubben</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {club.about}
              </p>
            </div>
          )}
          {club.practicalInfo && (
            <div className="card">
              <h2 className="display text-xl">Praktisk</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {club.practicalInfo}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Medlemskab */}
      {club.joinCode && !isMember && (
        <section className="rounded-2xl bg-ink px-6 py-8 text-chalk sm:px-10">
          <h2 className="display text-2xl">Bliv medlem</h2>
          <p className="mt-2 max-w-xl text-chalk/80">
            {club.memberPriceHour != null
              ? `Medlemmer booker til ${club.memberPriceHour} kr i timen i stedet for ${club.priceHour} kr.`
              : "Medlemmer har adgang til klubbens aktiviteter og hold."}{" "}
            Har du fået en kode af klubben, kan du tilmelde dig her.
          </p>
          {club.membershipInfo && (
            <p className="mt-4 max-w-xl whitespace-pre-line text-chalk/80">
              {club.membershipInfo}
            </p>
          )}
          <Link href={`/klub/${club.slug}/medlem`} className="btn-court mt-5">
            Indløs kode
          </Link>
        </section>
      )}

      {/* Galleri */}
      {club.images.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Anlægget</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {club.images.map((img: any) => (
              <img
                key={img.id}
                src={imageUrl(img.id)}
                alt={img.alt ?? `${club.name}`}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* Kontakt */}
      <section className="card">
        <h2 className="display text-xl">Kontakt</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {club.address && (
            <div className="flex gap-2">
              <dt className="text-slate">Adresse</dt>
              <dd>{club.address}, {club.city}</dd>
            </div>
          )}
          {club.contactEmail && (
            <div className="flex gap-2">
              <dt className="text-slate">E-mail</dt>
              <dd>
                <a href={`mailto:${club.contactEmail}`} className="underline">
                  {club.contactEmail}
                </a>
              </dd>
            </div>
          )}
          {club.contactPhone && (
            <div className="flex gap-2">
              <dt className="text-slate">Telefon</dt>
              <dd>{club.contactPhone}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-slate">Åbent</dt>
            <dd className="data">
              {club.openHour}–{club.closeHour}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bestyrelsen. Klubben vedligeholder den selv fra administrationen. */}
      {club.people.length > 0 && (
        <section className="card">
          <h2 className="display text-xl">Bestyrelse</h2>
          <ul className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {club.people.map((person: any) => (
              <li key={person.id}>
                <p className="font-bold">{person.name}</p>
                <p className="text-slate">{person.role}</p>
                {person.email && (
                  <a href={`mailto:${person.email}`} className="text-court underline">
                    {person.email}
                  </a>
                )}
                {person.phone && <p className="text-slate">{person.phone}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
