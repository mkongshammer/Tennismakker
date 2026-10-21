
import {UiText} from "./InternationalProvider";
import { dayKey, wallTime, addCalendarDays, formatMoney, formatDate, timeZoneLabel, wallParts } from "../lib/international";
import { phrase } from "../lib/phrases";
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
import { countsAsMember, openTypes } from "../lib/memberships";
import { waiverStatus } from "../lib/waiver";
import { upcomingEvents } from "../lib/events";
import { joinTeamWaitlist, joinCourtWaitlist } from "../lib/waitlist-actions";
import { openTeams } from "../lib/teams";
import { punchesIn } from "../lib/punch-cards";
import { buyClubPunchCard, joinClubMembership, joinSeasonTeam } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";
import { sportLabel, sportColor } from "../lib/sports";
import { imageUrl } from "../lib/imageUrl";


function hourRange(open: number, close: number, locale: string) {
  if (locale !== "en-US") return `${open}–${close}`;
  const h = (n: number) => `${n % 12 === 0 ? 12 : n % 12} ${n < 12 || n === 24 ? "AM" : "PM"}`;
  return `${h(open)} – ${h(close)}`;
}

export async function generateMetadata({ params }: {params: {slug: string;};}) {
  const club = await db.club.findUnique({ where: { slug: params.slug } });
  return {
    title: club ? `${club.name} — book bane` : "Klub",
    description: club?.tagline ?? club?.about ?? undefined
  };
}

/**
 * Klubbens side, uafhængigt af hvilken adresse man kom ind ad.
 *
 * Ligger for sig selv, fordi den vises to steder: på /clubs/<slug> og på
 * klubbens eget domæne. Før omdirigerede domænet til /clubs/<slug>, og så
 * stod der racketbuddy.app i adresselinjen et sekund efter — klubben havde
 * betalt for en hjemmeside, der sendte deres besøgende videre til vores.
 */
export async function ClubPage({
  slug,
  searchParams,
  ownDomain = false





}: {slug: string;searchParams: {dag?: string;date?: string;sport?: string;optaget?: string;fejl?: string;afvist?: string;venteliste?: string;kontingent?: string;}; /** Vises den på klubbens eget domæne? Så skjules vores egen navigation. */ownDomain?: boolean;}) {
  const club = await db.club.findUnique({
    where: { slug },
    include: {
      courts: { orderBy: { name: "asc" } },
      posts: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 },
      images: { where: { kind: "PHOTO" }, orderBy: { sortOrder: "asc" }, take: 8 },
      people: { orderBy: { sortOrder: "asc" } },
      _count: { select: { members: true } }
    }
  });
  if (!club || club.status !== "APPROVED") notFound();

  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const tr = (text: string, params?: Record<string, string | number>) => phrase(text, prefs.locale, params),money = (n: number) => formatMoney(n, club.currency, prefs.locale),date = (d: Date, options: Intl.DateTimeFormatOptions) => formatDate(d, prefs.locale, club.timeZone, options);
  await releaseExpiredHolds();

  // Ikke bare "koblet til klubben", men "tæller som medlem" — har klubben
  // kontingent hos os, skal det være betalt og løbende. Se countsAsMember.
  const isMember = await countsAsMember(user?.clubId ?? null, club.id, user?.id ?? null);
  const waiver = await waiverStatus(user?.id ?? null, club);
  const [memberships, teams, punchCards, myPunches, events, ladders] = await Promise.all([
  openTypes(club.id),
  openTeams(club.id),
  db.clubPunchCard.findMany({ where: { clubId: club.id, active: true } }),
  user ? punchesIn(user.id, club.id) : Promise.resolve([]),
  upcomingEvents(club.id, user?.id ?? null),
  db.ladder.findMany({ where: { clubId: club.id, active: true }, select: { id: true, name: true, _count: { select: { entries: true } } } })]
  );

  const todayKey = dayKey(new Date(), club.timeZone),today = wallTime(todayKey, 0, 0, club.timeZone)!;
  // Up to a month ahead, as in court search. `date=YYYY-MM-DD` (from a
  // dated search) wins over `dag=<offset>` (the day tabs below).
  const MAX_DAY_OFFSET = 30;
  const dateOffset = /^\d{4}-\d{2}-\d{2}$/.test(String(searchParams.date ?? "")) ?
  Math.round((Date.parse(`${searchParams.date}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000) :
  NaN;
  const dayOffset = Math.min(MAX_DAY_OFFSET, Math.max(0, Number.isFinite(dateOffset) ? dateOffset : Number(searchParams.dag ?? 0) || 0));
  const weekStart = Math.floor(dayOffset / 7) * 7;
  const dayKeyValue = addCalendarDays(todayKey, dayOffset),day = wallTime(dayKeyValue, 0, 0, club.timeZone)!;

  const [{ slots }, ratings] = await Promise.all([
  getClubAvailability(club.id, day, wallTime(addCalendarDays(dayKeyValue, 1), 0, 0, club.timeZone)!, { isMember }),
  clubRatings([club.id])]
  );
  const rating = ratings.get(club.id) ?? { average: 0, count: 0 };

  // Only what can still be booked: past hours vanish from today's grid.
  const now = new Date();
  const liveSlots = slots.filter((s) => s.startsAt.getTime() >= now.getTime());
  const nowParts = wallParts(now, club.timeZone);
  const firstHour = dayOffset === 0 ? Math.max(club.openHour, nowParts.hour + (nowParts.minute > 0 ? 1 : 0)) : club.openHour;
  const hours: number[] = [];
  for (let h = firstHour; h < club.closeHour; h++) hours.push(h);
  const sports = Array.from(new Set(club.courts.map((c: any) => c.sport))) as string[];
  // A club with several sports shows one grid at a time; the sport lives in
  // the URL so a shared link opens on the right courts.
  const activeSport = sports.includes(String(searchParams.sport ?? "").toUpperCase()) ? String(searchParams.sport).toUpperCase() : sports[0];
  const pageHref = (dag: number, sport = activeSport) => `/clubs/${club.slug}?${new URLSearchParams({ ...(dag ? { dag: String(dag) } : {}), ...(sports.length > 1 && sport !== sports[0] ? { sport } : {}) }).toString()}`.replace(/\?$/, "");
  const loginHref = `/login?next=${encodeURIComponent(pageHref(dayOffset))}`;
  // Hours with no free court at all, for the waitlist form under the grid.
  const dayParam = dayKeyValue;
  const freeHours = new Set(liveSlots.map((s) => wallParts(s.startsAt, club.timeZone).hour));
  const fullHours = hours.filter((h) => !freeHours.has(h)).map((h) => { const at = wallTime(dayKeyValue, h, 0, club.timeZone)!; return { iso: at.toISOString(), label: formatDate(at, prefs.locale, club.timeZone, { hour: "numeric", minute: "2-digit" }) }; });



  return (
    <div className="space-y-12">
      {/* Klubbens hoved — udseendet følger klubbens valgte tema */}
      {club.theme === "MARKANT" ?
      <section className="rounded-2xl bg-ink px-6 py-14 text-chalk sm:px-10 sm:py-20">
          <p className="eyebrow text-chalk/85">
            {sports.map((s) => sportLabel(s, prefs.locale)).join(" · ")}
          </p>
          <h1
          className="display mt-3 text-4xl leading-[0.95] sm:text-7xl"
          style={{ color: club.color }}>

            {club.name}
          </h1>
          {club.tagline &&
        <p className="mt-5 max-w-xl text-lg text-chalk/80">{club.tagline}</p>
        }
          <p className="data mt-8 text-sm text-chalk/60">
            {club.address ? `${club.address}` : club.city} · {club.courts.length} {club.courts.length === 1 ? tr("bane") : tr("baner")}
          {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
          </p>
        </section> :
      club.theme === "ENKEL" ?
      <section className="border-b border-slate/15 pb-8">
          <div
          className="mb-5 h-1.5 w-16 rounded-full"
          style={{ backgroundColor: club.color }} />

          <h1 className="display text-3xl sm:text-5xl">{club.name}</h1>
          {club.tagline &&
        <p className="mt-2 max-w-xl text-lg text-slate">{club.tagline}</p>
        }
          <p className="mt-4 text-sm text-slate">
            {club.address ? `${club.address}` : club.city} · {club.courts.length} {club.courts.length === 1 ? tr("bane") : tr("baner")}
          {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
          </p>
        </section> :

      <section className="relative overflow-hidden rounded-2xl">
          {club.heroId ?
        <>
              {/* Klubbens eget billede. Et mørkt lag ovenpå, så teksten kan
               læses uanset hvor lyst billedet er. */}
              <img
            src={imageUrl(club.heroId)}
            alt=""
            className="h-[300px] w-full object-cover sm:h-[420px]" />

              <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${club.color}f2 0%, ${club.color}99 45%, ${club.color}33 100%)`
            }} />

            </> :

        <div
          className="h-[260px] w-full sm:h-[340px]"
          style={{ backgroundColor: club.color }}>

              <svg
            className="h-full w-full opacity-[0.15]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            aria-hidden="true">

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
        }

          <div className="absolute inset-x-0 bottom-0 p-6 text-chalk sm:p-10">
            {club.logoId &&
          <img
            src={imageUrl(club.logoId)}
            alt={`${club.name} logo`}
            className="mb-4 h-16 w-16 rounded-xl bg-chalk/95 object-contain p-1.5 sm:h-20 sm:w-20" />

          }
            <p className="eyebrow text-chalk">
              {sports.map((s) => sportLabel(s, prefs.locale)).join(" · ")}
            </p>
            <h1 className="display mt-1 text-3xl drop-shadow-sm sm:text-5xl">
              {club.name}
            </h1>
            {club.tagline &&
          <p className="mt-2 max-w-xl text-lg text-chalk/90">{club.tagline}</p>
          }
            <p className="mt-3 text-sm font-semibold text-chalk/85">
              {club.address ? `${club.address}` : club.city} · {club.courts.length} {club.courts.length === 1 ? tr("bane") : tr("baner")}
            {rating.count > 0 && ` · ★ ${rating.average.toFixed(1)}`}
            </p>
            {isMember &&
          <p className="data mt-3 inline-block rounded-full bg-chalk/20 px-3 py-1 text-sm font-bold">{tr("Du er medlem \u2014 medlemspris")}

          </p>
          }
          </div>
        </section>
      }

      {/* Afvist af klubbens egne regler. Beskeden kommer fra club-rules.ts
           og er skrevet til at kunne læses af den, der blev afvist. */}
      {searchParams.afvist &&
      <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm font-semibold text-warning-ink">
          {tr(searchParams.afvist)}
        </p>
      }

      {(searchParams.optaget || searchParams.fejl) &&
      <p className="rounded-xl border border-court/25 bg-court/5 p-4 text-sm">
          {searchParams.fejl === "betaling" ?
        <UiText text="Klubben kan ikke tage imod betaling endnu, så bookingen blev ikke gennemført. Vi har givet klubben besked."/> :
        searchParams.fejl === "passeret" ?
        <UiText text="Det tidspunkt er passeret. Vælg en anden tid."/> :
        searchParams.fejl === "waiver" ?
        <UiText text="Accepter klubbens ansvarsfraskrivelse for at booke."/> :
        <UiText text="Den tid var lige taget. Her er resten af dagen — vælg en anden."/>}
        </p>
      }

      {/* Nyheder fra klubben */}
      {club.posts.length > 0 &&
      <section>
          <h2 className="display mb-3 text-2xl">{tr("Nyt fra klubben")}</h2>
          <ul className="space-y-3">
            {club.posts.map((post: any) =>
          <li key={post.id} className="card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold">{post.title}</p>
                  <p className="text-xs text-slate">
                    {date(post.createdAt, { day: "numeric", month: "long" })}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {post.body}
                </p>
              </li>
          )}
          </ul>
        </section>
      }

      {/* Booking */}
      <section>
        {!club.stripeChargesEnabled &&
        <div className="mb-5 rounded-xl border border-court/30 bg-court/5 p-4">
          <p className="font-bold">{tr("Denne klub kan ikke tage imod bookinger endnu")}</p>
          <p className="mt-1 text-sm text-slate">{tr("Klubben er ved at f\xE5 sin betalingsops\xE6tning p\xE5 plads. Tiderne nedenfor er vejledende, og en booking vil blive afvist indtil da.")}


          </p>
        </div>
        }

      <h2 className="display mb-1 text-2xl">{tr("Book bane")}</h2>
        <p className="mb-4 text-sm text-slate">
          {club.memberPriceHour != null && !isMember ?
          `${tr("Gæstepris")} ${money(club.priceHour)}. ${tr("Medlemspris")} ${money(club.memberPriceHour)}.` :
          <UiText text="Tiden holdes i 10 minutter, mens du betaler."/>}{" "}
          <UiText text="Gratis aflysning indtil 24 timer før."/>
        </p>

        <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 pb-1">
          <div className="flex w-max items-center gap-2">
            {weekStart > 0 &&
            <Link href={pageHref(Math.max(0, weekStart - 7))} aria-label="Earlier dates" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate/20 bg-chalk text-slate">
                <span aria-hidden="true">‹</span>
              </Link>
            }
            {Array.from({ length: Math.min(7, MAX_DAY_OFFSET + 1 - weekStart) }, (_, n) => {
              const i = weekStart + n;
              const d = wallTime(addCalendarDays(todayKey, i), 0, 0, club.timeZone)!;
              const active = i === dayOffset;
              return (
                <Link
                  key={i}
                  href={pageHref(i)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold capitalize ${
                  active ?
                  "bg-ink text-chalk" :
                  "border border-slate/20 bg-chalk text-slate"}`
                  }>

                  {date(d, { weekday: "short", day: "numeric", month: "numeric" })}
                </Link>);

            })}
            {weekStart + 7 <= MAX_DAY_OFFSET &&
            <Link href={pageHref(weekStart + 7)} aria-label="Later dates" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate/20 bg-chalk text-slate">
                <span aria-hidden="true">›</span>
              </Link>
            }
          </div>
        </div>

        <p className="mb-3 text-xs text-slate">All times in {timeZoneLabel(club.timeZone, prefs.locale)}.</p>
        {sports.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Sport">
            {sports.map((sport) => (
              <Link key={sport} href={pageHref(dayOffset, sport)} aria-current={sport === activeSport ? "true" : undefined} className={`pill ${sport === activeSport ? "is-active" : ""}`}>
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sportColor(sport) }} />
                {sportLabel(sport, prefs.locale)}
                <span className="text-xs font-medium opacity-70">{club.courts.filter((c: any) => c.sport === sport).length}</span>
              </Link>
            ))}
          </div>
        )}
        {sports.filter((sport) => sport === activeSport).map((sport) => {
          const sportCourts = club.courts.filter((c: any) => c.sport === sport);
          const courtIds = new Set(sportCourts.map((c: any) => c.id));
          return (
            <div key={sport}>
              <BookingGrid
                courts={sportCourts.map((c: any) => ({ id: c.id, name: c.name, surface: c.surface, sport: c.sport, indoor: c.indoor }))}
                slots={liveSlots.filter((s) => courtIds.has(s.courtId)).map((s) => ({ courtId: s.courtId, startsAt: s.startsAt.toISOString(), priceKr: s.priceKr }))}
                hours={hours}
                loggedIn={Boolean(user)}
                loginHref={loginHref}
                locale={prefs.locale}
                currency={club.currency}
                timeZone={club.timeZone}
                guestFeeKr={club.guestFeeKr}
                guestMax={club.guestMax}
                waiverText={waiver.text}
                waiverRequired={waiver.required}
              />
            </div>
          );
        })}


        {user && fullHours.length > 0 && (
          <form action={joinCourtWaitlist} className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate/15 bg-chalk p-4 text-sm">
            <input type="hidden" name="slug" value={club.slug} />
            <input type="hidden" name="date" value={dayParam} />
            <span className="flex-1 font-semibold">{tr("Vil du have en tid, der er optaget? Vi giver besked, hvis den bliver ledig.")}</span>
            <select name="slotAt" className="input w-auto py-1.5">
              {fullHours.map((h) => <option key={h.iso} value={h.iso}>{h.label}</option>)}
            </select>
            <SubmitButton className="btn-ghost btn-sm" pendingText="…">{tr("Giv mig besked")}</SubmitButton>
          </form>
        )}
        {searchParams.venteliste && <p className="mt-3 rounded-xl border border-court/25 bg-court/5 p-3 text-sm">{tr("Du står på ventelisten. Vi sender en mail og en push-besked, hvis der bliver plads.")}</p>}
        {!user && liveSlots.length > 0 &&
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate/15 bg-chalk p-4 text-sm sm:flex-row sm:items-center">
            <p className="flex-1 text-slate">Pick a time to reserve it. You’ll sign in or create a free account, then pay — the court is held for you for 10 minutes.</p>
            <div className="flex gap-2">
              <Link href={loginHref} className="btn-ghost btn-sm flex-1">Sign in</Link>
              <Link href={`/signup?next=${encodeURIComponent(pageHref(dayOffset))}`} className="btn-court btn-sm flex-1">Create account</Link>
            </div>
        </div>
        }
      </section>

      {/* Praktisk og om */}
      {(club.about || club.practicalInfo) &&
      <section className="grid gap-4 sm:grid-cols-2">
          {club.about &&
        <div className="card">
              <h2 className="display text-xl">{tr("Om klubben")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {club.about}
              </p>
            </div>
        }
          {club.practicalInfo &&
        <div className="card">
              <h2 className="display text-xl">{tr("Praktisk")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {club.practicalInfo}
              </p>
            </div>
        }
        </section>
      }

      {(events.length > 0 || ladders.length > 0) &&
      <section className="card" id="events">
          <h2 className="display text-2xl">{tr("Arrangementer og rangliste")}</h2>
          {events.length > 0 && <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col rounded-xl border border-slate/15 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate">{tr({ TOURNAMENT: "Turnering", LEAGUE: "Liga", SOCIAL: "Socialt arrangement", CLINIC: "Clinic" }[e.kind] ?? e.kind)}</p>
                <p className="mt-1 font-bold">{e.name}</p>
                <p className="text-sm text-slate">{date(e.startsAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {e.priceKr > 0 ? money(e.priceKr) : tr("Gratis")}{e.capacity ? ` · ${Math.max(0, e.capacity - e.taken)} ${tr("pladser tilbage")}` : ""}</p>
                <Link href={`/clubs/${club.slug}/events/${e.id}`} className={`mt-3 inline-block self-start ${e.mine === "PAID" ? "btn-ghost btn-sm" : "btn-court btn-sm"}`}>{e.mine === "PAID" ? tr("Du er tilmeldt") : e.full ? tr("Fuldt · venteliste") : tr("Se og tilmeld")}</Link>
              </li>
            ))}
          </ul>}
          {ladders.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist p-4">
            <p className="text-sm"><span className="font-bold">{ladders.map((l) => l.name).join(" · ")}</span><span className="text-slate"> · {ladders.reduce((n, l) => n + l._count.entries, 0)} {tr("spillere")}</span></p>
            <Link href={`/clubs/${club.slug}/ladder`} className="btn-ghost btn-sm">{tr("Se ranglisten")}</Link>
          </div>}
      </section>
      }

      {teams.length > 0 &&
      <section className="card">
          <h2 className="display text-2xl">{tr("S\xE6sonhold")}</h2>
          <p className="mt-1 text-sm text-slate">{tr("Tr\xE6ning p\xE5 et fast hold hele s\xE6sonen. Pladsen er din, n\xE5r der er betalt.")}


        </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {teams.map((team) =>
          <li key={team.id} className="rounded-xl border border-slate/15 p-4">
                <p className="font-bold">{team.name}</p>
                <p className="mt-0.5 text-sm text-slate">
                  {["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"][team.dayOfWeek]}{" " + tr("kl.")}{" "}
                  {String(team.hour).padStart(2, "0")}:00 · {team.minutes}{tr("min \xB7 niveau")}
              {team.levelFrom}–{team.levelTo}
                </p>
                <p className="text-sm text-slate">
                  {team.fromDate.toLocaleDateString(prefs.locale, {timeZone:"UTC", day: "numeric", month: "short" })} –{" "}
                  {team.toDate.toLocaleDateString(prefs.locale, {timeZone:"UTC", day: "numeric", month: "short", year: "numeric" })}
                  {team.coachName && ` · ${team.coachName}`}
                </p>
                {team.description &&
            <p className="mt-1 text-sm text-slate">{team.description}</p>
            }
                <p className="display mt-2 text-xl text-court">
                  {team.priceKr > 0 ? money(team.priceKr) : "Gratis"}
                </p>
                {team.full ?
            <div className="mt-2">
              <p className="text-sm font-semibold text-slate">{tr("Fuldtegnet")}</p>
              {user && <form action={joinTeamWaitlist} className="mt-2"><input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="slug" value={club.slug} /><SubmitButton className="btn-ghost btn-sm" pendingText="…">{tr("Skriv mig på ventelisten")}</SubmitButton></form>}
            </div> :
            user ?
            <form action={joinSeasonTeam} className="mt-3">
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="slug" value={club.slug} />
                    <SubmitButton pendingText={tr("\xC5bner\u2026")}>{tr("Tilmeld")}</SubmitButton>
                  </form> :

            <Link href="/login" className="btn-ghost mt-3 inline-block">{tr("Log ind for at tilmelde")}

            </Link>
            }
                {team.capacity > 0 && !team.full &&
            <p className="mt-2 text-xs text-slate-light">
                    {team.capacity - team.taken}{tr("pladser tilbage")}
            </p>
            }
              </li>
          )}
          </ul>
        </section>
      }

      {punchCards.length > 0 &&
      <section className="card">
          <h2 className="display text-2xl">{tr("Klippekort")}</h2>
          <p className="mt-1 text-sm text-slate">{tr("Flere banetimer betalt p\xE5 \xE9n gang. Klippet bruges automatisk, n\xE5r du booker.")}


        </p>

          {myPunches.map((p) =>
        <p key={p.purchaseId} className="mt-3 rounded-xl bg-court/10 p-3 text-sm font-semibold text-court">{tr("Du har")}
          {p.left}{" " + tr("af") + " "}{p.total}{" " + tr("timer tilbage p\xE5") + " "}{p.name}
              {p.expiresAt &&
          ` — gælder til ${p.expiresAt.toLocaleDateString(prefs.locale,{timeZone:club.timeZone})}`}
            </p>
        )}

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {punchCards.map((card: any) =>
          <li key={card.id} className="rounded-xl border border-slate/15 p-4">
                <p className="font-bold">{card.name}</p>
                <p className="mt-0.5 text-sm text-slate">
                  {card.sessions}{tr("timer")}
              {card.validDays > 0 && ` · gælder ${card.validDays} dage`}
                </p>
                {card.description &&
            <p className="mt-1 text-sm text-slate">{card.description}</p>
            }
                <p className="display mt-2 text-xl text-court">
                  {money(card.priceKr)}
                  <span className="ml-2 text-sm font-normal text-slate">
                    {money(Math.round(card.priceKr / card.sessions))} / {tr("time")}
                  </span>
                </p>
                {user ?
            <form action={buyClubPunchCard} className="mt-3">
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="slug" value={club.slug} />
                    <SubmitButton pendingText={tr("\xC5bner\u2026")}>{tr("K\xF8b")}</SubmitButton>
                  </form> :

            <Link href="/login" className="btn-ghost mt-3 inline-block">{tr("Log ind for at k\xF8be")}

            </Link>
            }
              </li>
          )}
          </ul>
        </section>
      }

      {/* Medlemskab */}
      {club.joinCode && !isMember &&
      <section className="rounded-2xl bg-ink px-6 py-8 text-chalk sm:px-10">
          <h2 className="display text-2xl">{tr("Bliv medlem")}</h2>
          <p className="mt-2 max-w-xl text-chalk/80">
            {club.memberPriceHour != null ?
          `${tr("Medlemspris")} ${money(club.memberPriceHour)} / ${tr("time")}. ${tr("Gæstepris")} ${money(club.priceHour)}.` :
          <UiText text="Medlemmer har adgang til klubbens aktiviteter og hold."/>}{" "}{tr("Har du f\xE5et en kode af klubben, kan du tilmelde dig her.")}

        </p>
          {memberships.length > 0 &&
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {memberships.map((m) =>
          <li key={m.id} className="rounded-xl bg-chalk/10 p-4">
                  <p className="font-bold text-chalk">
                    {m.name} — {m.seasonName}
                  </p>
                  <p className="mt-0.5 text-sm text-chalk/70">
                    {m.fromDate.toLocaleDateString(prefs.locale, {timeZone:"UTC", day: "numeric", month: "short" })} –{" "}
                    {m.toDate.toLocaleDateString(prefs.locale, {timeZone:"UTC", day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {m.description &&
            <p className="mt-1 text-sm text-chalk/70">{m.description}</p>
            }
                  <p className="display mt-2 text-xl text-optic">
                    {m.priceKr > 0 ? money(m.priceKr) : tr("Gratis")}{m.priceKr > 0 && m.interval === "MONTH" && <span className="text-sm text-chalk/70"> / {tr("måned")}</span>}
                  </p>
                  {m.familySize > 1 && <p className="mt-0.5 text-xs text-chalk/60">{tr("Familie: op til {p0} personer", { p0: m.familySize })}</p>}
                  {m.full ?
            <p className="mt-2 text-sm font-semibold text-chalk/60">{tr("Fuldtegnet")}</p> :
            user ?
            <form action={joinClubMembership} className="mt-3">
                      <input type="hidden" name="typeId" value={m.id} />
                      <input type="hidden" name="slug" value={club.slug} />
                      {m.familySize > 1 && <div className="mb-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-chalk/60">{tr("Hvem er med? (ud over dig)")}</p>
                        {Array.from({ length: m.familySize - 1 }).map((_, i) => <input key={i} name="dependent" className="input bg-chalk/10 text-chalk placeholder:text-chalk/40" placeholder={`${tr("Navn")} ${i + 2}`} maxLength={80} />)}
                      </div>}
                      <SubmitButton className="btn-court" pendingText={tr("\xC5bner\u2026")}>{tr("Tilmeld")}

              </SubmitButton>
                    </form> :

            <Link href="/login" className="btn-court mt-3 inline-block">{tr("Log ind for at tilmelde")}

            </Link>
            }
                  {m.capacity > 0 && !m.full &&
            <p className="mt-2 text-xs text-chalk/50">
                      {m.capacity - m.taken}{tr("pladser tilbage")}
            </p>
            }
                </li>
          )}
            </ul>
        }

          {club.membershipInfo &&
        <p className="mt-4 max-w-xl whitespace-pre-line text-chalk/80">
              {club.membershipInfo}
            </p>
        }
          <Link href={`/clubs/${club.slug}/medlem`} className="btn-court mt-5">{tr("Indl\xF8s kode")}

        </Link>
        </section>
      }

      {/* Galleri */}
      {club.images.length > 0 &&
      <section>
          <h2 className="display mb-3 text-2xl">{tr("Anl\xE6gget")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {club.images.map((img: any) =>
          <img
            key={img.id}
            src={imageUrl(img.id)}
            alt={img.alt ?? `${club.name}`}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-xl object-cover" />

          )}
          </div>
        </section>
      }

      {/* Kontakt */}
      <section className="card">
        <h2 className="display text-xl">{tr("Kontakt")}</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {club.address &&
          <div className="flex gap-2">
              <dt className="text-slate">{tr("Adresse")}</dt>
              <dd>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.address.includes(club.city) ? club.address : `${club.address}, ${club.city}`)}`} target="_blank" rel="noreferrer" className="underline">
                  {club.address.includes(club.city) ? club.address : `${club.address}, ${club.city}`}
                </a>
              </dd>
            </div>
          }
          {club.contactEmail &&
          <div className="flex gap-2">
              <dt className="text-slate">{tr("E-mail")}</dt>
              <dd>
                <a href={`mailto:${club.contactEmail}`} className="underline">
                  {club.contactEmail}
                </a>
              </dd>
            </div>
          }
          {club.contactPhone &&
          <div className="flex gap-2">
              <dt className="text-slate">{tr("Telefon")}</dt>
              <dd>{club.contactPhone}</dd>
            </div>
          }
          <div className="flex gap-2">
            <dt className="text-slate">{tr("\xC5bent")}</dt>
            <dd className="data">
              {hourRange(club.openHour, club.closeHour, prefs.locale)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bestyrelsen. Klubben vedligeholder den selv fra administrationen. */}
      {club.people.length > 0 &&
      <section className="card">
          <h2 className="display text-xl">{tr("Bestyrelse")}</h2>
          <ul className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {club.people.map((person: any) =>
          <li key={person.id}>
                <p className="font-bold">{person.name}</p>
                <p className="text-slate">{person.role}</p>
                {person.email &&
            <a href={`mailto:${person.email}`} className="text-court underline">
                    {person.email}
                  </a>
            }
                {person.phone && <p className="text-slate">{person.phone}</p>}
              </li>
          )}
          </ul>
        </section>
      }
    </div>);

}
