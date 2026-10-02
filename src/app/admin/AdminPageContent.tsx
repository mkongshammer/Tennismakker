import { phrase } from "../../lib/phrases";
import { InternationalProvider } from "../../components/InternationalProvider";
import { InternationalForm } from "./InternationalForm";
import { getPreferences } from "../../lib/preferences";
import { formatMoney, formatDate, dayKey, wallTime } from "../../lib/international";
import { clubHasSection, clubHasFeature } from "../../lib/club-features";
import { MemberForm } from "./MemberForm";
import { WalletForm } from "./WalletForm";
import { ManualLights } from "./ManualLights";
import { ResasportsForm } from "./ResasportsForm";
import { ImportForm } from "./ImportForm";
import { WalletBalances } from "./WalletBalances";
import React from "react";
import { ADMIN_PAGES, adminHref, type AdminSection } from "../../lib/admin-navigation";
import { AdminNavigation } from "./AdminNavigation";
import { sportLabel } from "../../lib/sports";
import { clubSports, facilityLabel } from "../../lib/club-sports";
// Klub-administration: her styrer klubben, hvordan RacketBuddy henter
// ledighed, og hvilke tider udefrakommende spillere må booke.
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { markClubEntered, syncNow, withdrawGuestSlot, toggleRule, deleteRule, setLastMinute, generateJoinCode, deletePost, setTheme, startClubSubscription, openClubBillingPortal } from "../../lib/actions";
import { INTEGRATION_LABELS } from "../../lib/integrations/types";
import { SURFACES } from "../../lib/levels";
import { IntegrationForm } from "./IntegrationForm";
import { ReleaseForm } from "./ReleaseForm";
import { RuleForm } from "./RuleForm";
import { SiteForm, PostForm } from "./SiteForm";
import { PeopleForm } from "./PeopleForm";
import { FixedSlotForm } from "./FixedSlotForm";
import { CourtForm } from "./CourtForm";
import { AdminsForm } from "./AdminsForm";
import { PriceRuleForm } from "./PriceRuleForm";
import { SystemLoginForm } from "./SystemLoginForm";
import { ClubControlPanel } from "./ClubControlPanel";
import { blockSummary } from "../../lib/system-blocks";
import { MembershipForm } from "./MembershipForm";
import { PunchCardForm, TeamForm } from "./TeamAndPunchForms";
import { DomainForm } from "./DomainForm";
import { ImageForms } from "./ImageForms";
import { startClubPayoutSetup } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { refreshAccountStatus } from "../../lib/connect";
import { stripeEnabled } from "../../lib/stripe";
import { getSettings } from "../../lib/settings";
import { subscriptionIsActive } from "../../lib/billing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPageContent({
  searchParams,
  section = "oversigt"



}: {searchParams: Promise<{stripe?: string;abonnement?: string;}>;section?: AdminSection;}) {
  const query = await searchParams;
  const prefs = await getPreferences();const tr=(text:string,params?:Record<string,string|number>)=>phrase(text,prefs.locale,params);
  if (section === "oversigt" && (query.stripe || query.abonnement)) redirect(`/admin/betaling?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null) as [string, string][]).toString()}`);
  const currentPage = ADMIN_PAGES.find((p) => p.id === section)!;
  const user = await getCurrentUser();
  const stripeOn = await stripeEnabled();
  const pct = Math.round((await getSettings()).commissionPct * 100);
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">{tr("Kun for klub-administratorer")}</p>
        <p className="mt-1 text-sm text-slate/60">{tr("Din konto er ikke tilknyttet en klub. Kontakt RacketBuddy for at f\xE5 jeres klub med.")}

        </p>
      </div>);

  }

  if (query.stripe === "return" || query.stripe === "refresh") {
    const admin = await getCurrentUser();
    if (admin?.clubId) await refreshAccountStatus("CLUB", admin.clubId).catch(() => null);
  }

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    include: {
      courts: {
        orderBy: { name: "asc" },
        include: { _count: { select: { bookings: true } } }
      },
      members: true,
      posts: { orderBy: { createdAt: "desc" }, take: 10 },
      images: { orderBy: { sortOrder: "asc" } },
      people: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!club) redirect("/");
  if (club.signupManaged && club.status !== "APPROVED" && section !== "betaling") redirect("/club-start");
  if (!clubHasSection(club.solutionMode, section, club.customFeatures)) redirect("/admin");
  const selectedSports = clubSports(club.sports, club.courts);

  // Faste baner hører til banerne, ikke til klubben, så de hentes for sig.
  const [seasonTeams, punchCards] = await Promise.all([
  section === 'hold' ? db.seasonTeam.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { dayOfWeek: "asc" }],
    include: { _count: { select: { signups: { where: { status: "PAID" } } } } }
  }) : Promise.resolve([]),
  section === 'priser' ? db.clubPunchCard.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }]
  }) : Promise.resolve([])]
  );

  const [systemLogin, blocks] = await Promise.all([
  section === 'integrationer' ? db.clubSystemLogin.findUnique({ where: { clubId: club.id } }) : Promise.resolve(null),
  section === 'integrationer' ? blockSummary(club.id) : Promise.resolve(null)]
  );

  const priceRules = await (section === 'priser' ? db.priceRule.findMany({
    where: { clubId: club.id },
    orderBy: { sortOrder: "asc" }
  }) : Promise.resolve([]));

  const membershipTypes = await (section === 'medlemmer' ? db.membershipType.findMany({
    where: { clubId: club.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: { _count: { select: { memberships: { where: { status: "PAID" } } } } }
  }) : Promise.resolve([]));

  const fixedSlots = await (section === 'bookinger' ? db.fixedSlot.findMany({
    where: { court: { clubId: club.id } },
    include: { court: { select: { name: true } }, user: { select: { name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }]
  }) : Promise.resolve([]));

  const clubControl = await (section === 'lys-adgang' ? db.clubControl.findUnique({
    where: { clubId: club.id },
    include: {
      devices: {
        orderBy: { createdAt: "asc" },
        include: { channels: { orderBy: { channel: "asc" } } }
      }
    }
  }) : Promise.resolve(null));

  const courtIds = club.courts.map((c: any) => c.id);
  const today = wallTime(dayKey(new Date(), club.timeZone), 0, 0, club.timeZone)!;

  const [upcoming, payments, rules, guestSlots] = await Promise.all([
  section === 'oversigt' || section === 'bookinger' ? db.booking.findMany({
    where: {
      courtId: { in: courtIds },
      status: "CONFIRMED",
      startsAt: { gte: today, lt: addDays(today, 8) }
    },
    include: { user: true, court: true },
    orderBy: { startsAt: "asc" }
  }) : Promise.resolve([]),
  section === 'oversigt' ? db.payment.findMany({
    where: { status: "PAID", booking: { courtId: { in: courtIds } } }
  }) : Promise.resolve([]),
  section === 'tider' ? db.guestRule.findMany({ where: { clubId: club.id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  section === 'tider' ? db.guestSlot.findMany({
    where: { courtId: { in: courtIds }, startsAt: { gte: new Date() } },
    include: { court: true },
    orderBy: { startsAt: "asc" },
    take: 50
  }) : Promise.resolve([])]
  );

  const gross = payments.reduce((s: number, p: any) => s + p.amountKr, 0);
  const fees = payments.reduce((s: number, p: any) => s + p.platformFee, 0);
  const toEnter = upcoming.filter((b: any) => b.needsClubEntry && !b.clubEnteredAt);

  return (
    <InternationalProvider country={club.country} locale={prefs.locale} currency={club.currency} timeZone={club.timeZone}><div className="space-y-6">
<div>
        <h1 className="display text-3xl">{club.name}</h1>
        <p className="mt-2 text-sm">{selectedSports.map((s) => sportLabel(s, prefs.locale)).join(" · ") || tr("Vælg klubbens sportsgrene for at komme i gang.")}</p>
        <a className="inline-block mt-2 font-semibold text-court underline" href="/admin/baner">{tr("Sportsgrene og") + " "}{tr(facilityLabel(selectedSports)).toLowerCase()}</a>
        <p className="text-sm text-slate">{club.currency} · {club.timeZone}</p>
        <p className="text-slate/70">{tr("Klubside: /klub/")}
            {club.slug} · {tr(INTEGRATION_LABELS[club.integrationType as keyof typeof INTEGRATION_LABELS])}
        </p>
      </div>
{query.abonnement &&
        <p className="card border border-court/25 text-sm">
          {query.abonnement === "ok" ?
          tr("Tak — abonnementet er startet. Kvitteringen ligger i jeres indbakke.") :
          query.abonnement === "afbrudt" ?
          tr("Betalingen blev afbrudt. Abonnementet er ikke startet.") :
          query.abonnement === "portal" ?
          tr("Selvbetjeningen kunne ikke åbnes lige nu. Skriv til os, så ordner vi det.") :
          tr("Abonnementet kunne ikke startes lige nu. Prøv igen, eller skriv til os.")}
        </p>
        }
<div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
<AdminNavigation features={club.customFeatures} mode={club.solutionMode} section={section} facility={tr(facilityLabel(selectedSports))} locale={prefs.locale} />
<div className="min-w-0 space-y-6">
<header><h2 className="display text-2xl">{section === 'baner' ? tr(facilityLabel(selectedSports)) + ' ' + tr('og sportsgrene') : phrase(currentPage.label, prefs.locale)}</h2><p className="mt-1 text-sm text-slate">{phrase(currentPage.description, prefs.locale)}</p></header>
{section === 'oversigt' && <>
<section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate/60">{tr(facilityLabel(selectedSports))}</p>
          <p className="display text-3xl">{club.courts.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">{tr("G\xE6stebookinger")}</p>
          <p className="display text-3xl">{payments.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">{tr("Oms\xE6tning")}</p>
          <p className="display text-3xl">{formatMoney(gross, club.currency, prefs.locale)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate/60">{tr("Udbetalt til jer")}</p>
          <p className="display text-3xl text-ink">{formatMoney(gross - fees, club.currency, prefs.locale)}</p>
        </div>
      </section>
</>}
{section === 'bookinger' && <>
{toEnter.length > 0 &&
              <section className="rounded-lg border-2 border-court bg-court/5 p-5">
          <p className="display text-xl text-court-dark">
            {tr("{count} bookinger skal ind i jeres eget system",{count:toEnter.length})}
                </p>
          <p className="mt-1 text-sm">{tr("G\xE6sten har betalt hos os. F\xF8r tiden ind i")}
                  {club.externalSystem || tr("klubbens bookingsystem")}{tr(", s\xE5 banen ikke bliver dobbeltbooket.")}

                </p>
          <ul className="mt-4 space-y-2">
            {toEnter.map((b: any) =>
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3">
                <span className="text-sm">
                  <span className="font-bold capitalize">
                    {formatDate(b.startsAt, prefs.locale, b.timeZone, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>{" "}
                  · {b.court?.name} · {b.user.name}
                </span>
                <form action={markClubEntered}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-ink text-sm">{tr("F\xF8rt ind")}</button>
                </form>
              </li>
                  )}
          </ul>
        </section>
              }
<section>
        <h2 className="display mb-3 text-2xl">{tr("Kommende g\xE6stebookinger")}</h2>
        {upcoming.length === 0 && <p className="text-slate/60">{tr("Ingen bookinger i den kommende uge.")}</p>}
        <ul className="space-y-2">
          {upcoming.map((b: any) =>
                  <li key={b.id} className="card flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="font-semibold capitalize">
                {formatDate(b.startsAt, prefs.locale, b.timeZone, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}–{formatDate(b.endsAt, prefs.locale, b.timeZone, { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {b.court?.name}
              </span>
              <span>{b.user.name}</span>
              <span className="text-slate/60">
                {formatMoney(b.priceKr, b.currency, prefs.locale)}
                {b.needsClubEntry && !b.clubEnteredAt &&
                      <span className="ml-2 font-bold text-court">{tr("skal f\xF8res ind")}</span>
                      }
              </span>
            </li>
                  )}
        </ul>
      </section>
{clubHasFeature(club.solutionMode, club.customFeatures, 'faste-bookinger') && <section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Faste baner")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Samme bane, samme ugedag, hele s\xE6sonen. Klubben tildeler dem \u2014 medlemmet booker dem ikke selv. Tiderne oprettes som almindelige bookinger, s\xE5 de sp\xE6rrer banen og kan aflyses enkeltvis.")}



                </p>
        <FixedSlotForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  members={club.members.map((m: any) => ({ id: m.id, name: m.name }))}
                  slots={fixedSlots as any}
                  defaultPrice={club.memberPriceHour ?? club.priceHour} />

      </section>}
</>}
{section === 'tider' && <>
{club.integrationType === "MANUAL" &&
              <section>
          <h2 className="display mb-1 text-2xl">{tr("Frigiv tider til g\xE6ster")}</h2>
          <p className="mb-3 text-sm text-slate/60">{tr("Kun tider, I frigiver her, kan ses og bookes af spillere udefra.")}

                </p>

          <div className="mb-4 rounded-lg border border-slate/15 bg-white p-4 text-sm">
            <p className="font-bold">{tr("S\xE6lger I ogs\xE5 baner et andet sted?")}</p>
            <p className="mt-1 text-slate/70">{tr("Bruger I b\xE5de os og en anden platform, kan vi ikke se hinandens bookinger. Frigiv derfor forskellige tider til hver kanal \u2014 eller afs\xE6t en bane til hver. S\xE5 kan den samme time ikke s\xE6lges to gange.")}



                  </p>
            <p className="mt-2 text-slate/70">{tr("Tag altid tiden ud af jeres eget system, n\xE5r I frigiver den her.")}

                  </p>
          </div>
          <RuleForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  defaultPrice={club.priceHour}
                  externalSystem={club.externalSystem ?? tr("jeres eget bookingsystem")} />


          {rules.length > 0 &&
                <>
              <h3 className="mb-2 mt-6 font-bold">{tr("Jeres regler")}</h3>
              <ul className="space-y-2">
                {rules.map((r: any) => {
                      const dayNames = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
                      const days = r.daysOfWeek.
                      split(",").
                      map((d: string) => tr(dayNames[Number(d)])).
                      join(", ");
                      const courtNames = r.courtIds ?
                      r.courtIds.
                      split(",").
                      map((id: string) => club.courts.find((c: any) => c.id === id)?.name).
                      filter(Boolean).
                      join(", ") :
                      tr("alle baner");
                      return (
                        <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className={`font-semibold ${r.active ? "" : "text-slate line-through"}`}>
                          {days} · {r.fromHour}–{r.toHour} · {courtNames}
                        </p>
                        <p className="data text-sm text-slate">{formatMoney(r.priceKr, club.currency, prefs.locale)}{tr("/time")}</p>
                      </div>
                      <div className="flex gap-2">
                        <form action={toggleRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm font-semibold text-court underline">
                            {r.active ? tr("Sæt på pause") : tr("Aktivér")}
                          </button>
                        </form>
                        <form action={deleteRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-sm text-slate underline">{tr("Slet")}</button>
                        </form>
                      </div>
                    </li>);

                    })}
              </ul>
            </>
                }

          <div className="card mt-6">
            <p className="font-bold">{tr("Sidste \xF8jeblik")}</p>
            <p className="mt-1 text-sm text-slate">{tr("Frigiv automatisk alt, der stadig st\xE5r tomt t\xE6t p\xE5 spilletidspunktet. En bane der er ledig om en time er tabt indt\xE6gt uanset hvad.")}


                  </p>
            <form action={setLastMinute} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="hours">{tr("Timer f\xF8r start")}</label>
                <input
                        className="input w-32"
                        id="hours"
                        name="hours"
                        type="number"
                        min={0}
                        max={72}
                        defaultValue={club.lastMinuteHours} />

              </div>
              <button className="btn-ghost">{tr("Gem")}</button>
            </form>
            <p className="mt-2 text-xs text-slate">{tr("0 sl\xE5r det fra.")}</p>
          </div>

          <h3 className="mb-2 mt-6 font-bold">{tr("Enkelte tider")}</h3>
          <p className="mb-3 text-sm text-slate">{tr("Til undtagelser \u2014 en enkelt aften der alligevel blev fri.")}

                </p>
          <ReleaseForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  defaultPrice={club.priceHour}
                  externalSystem={club.externalSystem ?? tr("jeres eget bookingsystem")} />


          <h3 className="mb-2 mt-6 font-bold">{tr("Frigivne enkelttider")}</h3>
          {guestSlots.length === 0 ?
                <p className="text-sm text-slate/60">{tr("Ingen tider er frigivet endnu.")}</p> :

                <ul className="card divide-y divide-slate/10">
              {guestSlots.map((s: any) =>
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="capitalize">
                    {formatDate(s.startsAt,prefs.locale,club.timeZone,{weekday:"short",day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})} · {s.court.name} ·{" "}
                    {formatMoney(s.priceKr, club.currency, prefs.locale)}
                  </span>
                  <form action={withdrawGuestSlot}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-court underline">{tr("Fjern")}</button>
                  </form>
                </li>
                  )}
            </ul>
                }
        </section>
              }
</>}
{section === 'medlemmer' && <>
<MemberForm types={membershipTypes.map((t) => ({ id: t.id, name: t.name }))} />
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Kontingent")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Medlemmerne tilmelder sig fra jeres side og betaler online. Pengene g\xE5r direkte til klubbens konto. Er kontingentet betalt og s\xE6sonen i gang, booker medlemmet til medlemspris.")}



                </p>
        <MembershipForm
                  types={membershipTypes.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    seasonName: t.seasonName,
                    description: t.description,
                    fromDate: t.fromDate,
                    toDate: t.toDate,
                    priceKr: t.priceKr,
                    capacity: t.capacity,
                    active: t.active,
                    paid: t._count.memberships
                  }))} />

      </section>
</>}
{section === 'hold' && <>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("S\xE6sonhold")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Tr\xE6ningshold over en s\xE6son. Medlemmerne tilmelder sig fra jeres side og betaler online. Pengene g\xE5r til klubbens konto.")}


                </p>
        <TeamForm
                  teams={seasonTeams.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    dayOfWeek: t.dayOfWeek,
                    hour: t.hour,
                    fromDate: t.fromDate,
                    toDate: t.toDate,
                    priceKr: t.priceKr,
                    capacity: t.capacity,
                    active: t.active,
                    paid: t._count.signups
                  }))}
                  locale={prefs.locale} />

      </section>
</>}
{section === 'nyheder' && <>
<section>
        <h2 className="display mb-1 text-2xl">{tr("Nyheder")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Vises \xF8verst p\xE5 jeres side. Til lukkedage, turneringer og andet, folk skal vide.")}


                </p>
        <PostForm />

        {club.posts.length > 0 &&
                <ul className="mt-4 space-y-2">
            {club.posts.map((post: any) =>
                  <li key={post.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {post.pinned && <span className="text-court">★ </span>}
                    {post.title}
                  </p>
                  <p className="text-xs text-slate">
                    {formatDate(post.createdAt,prefs.locale,club.timeZone,{dateStyle:"long"})}
                  </p>
                </div>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className="text-sm text-slate underline">{tr("Slet")}</button>
                </form>
              </li>
                  )}
          </ul>
                }
      </section>
</>}
{section === 'baner' && <>
<section id="sportsgrene">
        <h2 className="display mb-1 text-2xl">{tr(facilityLabel(selectedSports))}</h2>
        <p className="mb-4 text-sm text-slate">{tr("V\xE6lg sportsgrene, og opret klubbens")}
                  {tr(facilityLabel(selectedSports)).toLowerCase()}{tr("med egne navne, underlag og priser.")}
                </p>
        <CourtForm
                  sports={selectedSports}
                  courts={club.courts.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    sport: c.sport,
                    surface: c.surface,
                    indoor: c.indoor,
                    priceHour: c.priceHour,
                    memberPriceHour: c.memberPriceHour,
                    bookings: c._count?.bookings ?? 0
                  }))} />

      </section>
</>}
{section === 'lys-adgang' && <>
<ManualLights channels={await db.clubControlChannel.findMany({ where: { device: { control: { clubId: club.id, enabled: true } }, kind: { in: ['COURT_LIGHT', 'COMMON_LIGHT'] }, setupConfirmedAt: { not: null } }, select: { id: true, label: true } })} />
<section>
        <h2 className="display mb-1 text-2xl">{tr("Automatisk lys og adgang")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Knyt klubbens Shelly-controllere til de bookbare omr\xE5der og d\xF8ren. RacketBuddy t\xE6nder lyset ud fra bookingerne, og spilleren kan kun \xE5bne d\xF8ren i tidsvinduet omkring sin egen bekr\xE6ftede booking.")}



                </p>
        <ClubControlPanel
                  courts={club.courts.map((court: any) => ({ id: court.id, name: court.name }))}
                  control={clubControl ? {
                    enabled: clubControl.enabled,
                    serverUrl: clubControl.serverUrl,
                    hasAuthKey: Boolean(clubControl.authKeyCipher),
                    accessBeforeMinutes: clubControl.accessBeforeMinutes,
                    accessAfterMinutes: clubControl.accessAfterMinutes,
                    doorPulseSeconds: clubControl.doorPulseSeconds,
                    lightsBeforeMinutes: clubControl.lightsBeforeMinutes,
                    lightsAfterMinutes: clubControl.lightsAfterMinutes,
                    lastCheckedAt: clubControl.lastCheckedAt?.toISOString() ?? null,
                    lastOkAt: clubControl.lastOkAt?.toISOString() ?? null,
                    lastError: clubControl.lastError,
                    devices: clubControl.devices.map((device: any) => ({
                      id: device.id,
                      name: device.name,
                      externalId: device.externalId,
                      model: device.model,
                      channelCount: device.channelCount,
                      online: device.online,
                      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
                      channels: device.channels.map((channel: any) => ({
                        id: channel.id,
                        channel: channel.channel,
                        kind: channel.kind,
                        label: channel.label,
                        courtId: channel.courtId,
                        lastState: channel.lastState,
                        lastCommandAt: channel.lastCommandAt?.toISOString() ?? null,
                        setupTestedAt: channel.setupTestedAt?.toISOString() ?? null,
                        setupConfirmedAt: channel.setupConfirmedAt?.toISOString() ?? null,
                        lastError: channel.lastError
                      }))
                    }))
                  } : null} />

      </section>
</>}
{section === 'priser' && <>
<WalletForm enabled={club.walletEnabled} tiers={JSON.parse(club.walletTiers || '[]')} />
<WalletBalances clubId={club.id} locale={prefs.locale} />
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Priser efter tidspunkt")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Prime time koster mere. Uden regler her g\xE6lder banens pris, og har banen ingen, g\xE6lder klubbens.")}


                </p>
        <PriceRuleForm
                  courts={club.courts.map((c: any) => ({ id: c.id, name: c.name }))}
                  rules={priceRules as any} />

      </section>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Klippekort")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Flere banetimer betalt p\xE5 \xE9n gang. Klippet tr\xE6kkes automatisk, n\xE5r medlemmet booker \u2014 i stedet for en betaling.")}


                </p>
        <PunchCardForm cards={punchCards as any} />
      </section>
</>}
{section === 'betaling' && <>
{stripeOn &&
              <section className="card">
          <p className="display text-xl">{tr("Udbetalinger")}</p>
          {club.stripeChargesEnabled ?
                <p className="mt-2 text-sm">
              <span className="font-bold text-court">{tr("Aktivt.")}</span>{tr("G\xE6ster kan betale, og pengene sendes automatisk til jeres konto minus vores andel.")}

                </p> :

                <>
              <p className="mt-2 rounded-xl border border-court/30 bg-court/5 p-3 text-sm font-semibold">{tr("G\xE6ster kan ikke booke hos jer endnu. Jeres tider vises, men en booking afvises, indtil dette er p\xE5 plads.")}


                  </p>
              <p className="mt-2 text-sm text-slate">{tr("Klubben skal have en Stripe-konto, f\xF8r g\xE6ster kan booke og betale. Det tager typisk 5-10 minutter \u2014 I skal bruge NemID/MitID og klubbens kontonummer.")}



                  </p>
              <form action={startClubPayoutSetup} className="mt-3">
                <SubmitButton pendingText={tr("\xC5bner Stripe\u2026")}>
                  {club.stripeAccountId ? tr("Fortsæt opsætning") : tr("Sæt udbetalinger op")}
                </SubmitButton>
              </form>
            </>
                }
        </section>
              }
<section className="card">
        <p className="display text-xl">{tr("Jeres aftale")}</p>
        <>
          <>
            <p className="mt-2">
              <span className="font-bold">{formatMoney(club.subscriptionKr,club.billingCurrency,prefs.locale)}/{tr("måned")}</span>{" "}{tr("I beholder hele bel\xF8bet for hver g\xE6stebooking.")}

                    </p>
            <p className="mt-1 text-sm text-slate">{tr("Tider kan kun frigives, mens abonnementet er aktivt. Bookinger, en g\xE6st har betalt for, st\xE5r ved magt uanset hvad.")}


                    </p>
            <p className="mt-1 text-sm text-slate/60">{tr("Fast pris uanset hvor mange bookinger der kommer ind. Vi tager intet af den enkelte booking \u2014 hele bel\xF8bet g\xE5r til jer.")}


                    </p>

            {subscriptionIsActive(club) ?
                    <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court">{tr("Betaling aktiv.")}</span>{" "}
                  {club.subscriptionRenewsAt ?
                        tr("Fornyes {date}.",{date:formatDate(club.subscriptionRenewsAt,prefs.locale,club.timeZone,{day:"numeric",month:"long"})}) :
                        tr("Fornyes automatisk hver måned.")}
                </p>
                <form action={openClubBillingPortal} className="mt-3">
                  <SubmitButton className="btn-ghost" pendingText={tr("\xC5bner Stripe\u2026")}>{tr("Kort, fakturaer og opsigelse")}

                        </SubmitButton>
                </form>
              </> :

                    <>
                <p className="mt-3 text-sm">
                  <span className="font-bold text-court-dark">
                    {club.subscriptionStatus === "past_due" || club.subscriptionStatus === "unpaid" ?
                          tr("Betalingen fejlede.") :
                          club.subscriptionStatus === "canceled" ?
                          tr("Abonnementet er opsagt.") :
                          tr("Abonnementet er ikke startet.")}
                  </span>{" "}{tr("Indtil det betales, tr\xE6kkes")}
                        {pct}{tr("% af hver g\xE6stebooking i stedet.")}
                      </p>
                <form action={startClubSubscription} className="mt-3">
                  <SubmitButton pendingText={tr("\xC5bner Stripe\u2026")}>
                    {club.stripeCustomerId ? tr("Forny betaling") : tr("Start abonnement")}
                  </SubmitButton>
                </form>
              </>
                    }
          </>
        </>
        <p className="mt-3 text-sm text-slate/60">{tr("Vil I skifte model, s\xE5 skriv til os.")}

                </p>
      </section>
</>}
{section === 'integrationer' && <>
{clubHasFeature(club.solutionMode, club.customFeatures, 'import') && <><ResasportsForm courts={club.courts.map((c) => ({ id: c.id, name: c.name }))} /><ImportForm /></>}
<section>
        <h2 className="display mb-1 text-2xl">{tr("S\xE5dan finder vi jeres ledige tider")}</h2>
        <p className="mb-4 text-sm text-slate/60">{tr("I beholder jeres eget bookingsystem. V\xE6lg hvordan vi skal vide, hvad der er ledigt.")}

                </p>
        <IntegrationForm
                  integrationType={club.integrationType}
                  icalUrl={club.icalUrl ?? ""}
                  externalSystem={club.externalSystem ?? ""} />


        {club.integrationType === "ICAL" &&
                <div className="card mt-4">
            <p className="font-bold">{tr("Synkronisering")}</p>
            <p className="mt-1 text-sm text-slate/60">
              {club.lastSyncAt ?
                    tr("Sidst hentet {date}.",{date:formatDate(club.lastSyncAt,prefs.locale,club.timeZone,{dateStyle:"medium",timeStyle:"short"})}) :
                    tr("Feed er ikke hentet endnu.")}
            </p>
            {club.lastSyncError &&
                  <p className="mt-2 text-sm font-semibold text-court">{tr(club.lastSyncError)}</p>
                  }
            <form action={syncNow} className="mt-3">
              <button className="btn-ink">{tr("Synkronis\xE9r nu")}</button>
            </form>
          </div>
                }
      </section>
{club.integrationType !== "NATIVE" &&
              <section className="card">
          <h2 className="display mb-1 text-2xl">{tr("Lad os sp\xE6rre tiderne i")}
                  {club.externalSystem ?? tr("jeres system")}
          </h2>
          <p className="mb-4 text-sm text-slate">{tr("Giver I os et login, sp\xE6rrer vi selv de tider, I frigiver \u2014 s\xE5 skal I ikke g\xF8re det i h\xE5nden hver gang.")}


                </p>
          <SystemLoginForm
                  system={club.externalSystem ?? tr("jeres system")}
                  saved={systemLogin ? { baseUrl: systemLogin.baseUrl, username: systemLogin.username } : null}
                  lastOkAt={systemLogin?.lastOkAt ?? null}
                  lastError={systemLogin?.lastError ?? null}
                  summary={systemLogin ? blocks : null} />

        </section>
              }
</>}
{section === 'hjemmeside' && <>
<section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl">{tr("Jeres side")}</h2>
          <Link href={`/klub/${club.slug}`} className="text-sm font-semibold text-court underline">{tr("Se den som g\xE6sterne g\xF8r")}

                  </Link>
        </div>
        <p className="mb-4 text-sm text-slate">{tr("Bruger I os som jeres eneste system, er det her jeres hjemmeside.")}

                </p>
        <ImageForms
                  logoId={club.logoId}
                  heroId={club.heroId}
                  photos={club.images.
                  filter((i: any) => i.kind === "PHOTO").
                  map((i: any) => ({ id: i.id, alt: i.alt }))} />


        <div className="mt-4">
          <SiteForm club={club} />
        </div>

        <div className="card mt-4">
          <p className="font-bold">{tr("Udseende")}</p>
          <p className="mt-1 text-sm text-slate">{tr("Tre m\xE5der at vise klubben p\xE5. Skift frit \u2014 det \xE6ndrer kun forsiden, ikke indholdet.")}


                  </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
                    ["KLASSISK", "Klassisk", "Farvet hoved med banemotiv"],
                    ["MARKANT", "Markant", "Mørkt hoved, stort klubnavn"],
                    ["ENKEL", "Enkel", "Lyst og roligt"]].
                    map(([value, label, hint]) =>
                    <form action={setTheme} key={value}>
                <input type="hidden" name="theme" value={value} />
                <button
                        className={`rounded-xl border px-4 py-3 text-left ${
                        club.theme === value ?
                        "border-court bg-court/5" :
                        "border-slate/20"}`
                        }>

                  <span className="block font-semibold">{tr(label)}</span>
                  <span className="block text-xs text-slate">{tr(hint)}</span>
                </button>
              </form>
                    )}
          </div>
        </div>

        <div className="card mt-4">
          <p className="font-bold">{tr("Eget dom\xE6ne")}</p>
          <p className="mt-1 text-sm text-slate">{tr("Jeres side kan ligge p\xE5 klubbens eget dom\xE6ne i stedet for hos os. S\xE5 st\xE5r der jerklub.dk i adresselinjen, og vores navigation vises ikke.")}



                  </p>
          <div className="mt-4">
            <DomainForm
                      clubId={club.id}
                      domain={club.customDomain}
                      status={club.domainStatus} />

          </div>
        </div>
        <p className="mt-2 text-xs text-slate">{tr("Laver I en ny kode, holder den gamle op med at virke. Medlemmer der allerede er meldt ind, bliver ved med at v\xE6re det.")}


                </p>
      </section>
</>}
{section === 'indstillinger' && <>
<section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Hvem kan administrere klubben")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("\xC9n person med n\xF8glen er \xE9n person for lidt. Stopper vedkommende i bestyrelsen, mister klubben adgangen til sine egne bookinger og indt\xE6gter.")}



                </p>
        <InternationalForm club={club} locale={prefs.locale} /><AdminsForm
                  meId={user.id}
                  members={club.members.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    isAdmin: m.role === "CLUB_ADMIN"
                  }))} />

      </section>
{clubHasFeature(club.solutionMode, club.customFeatures, 'hjemmeside') && <section className="card">
        <h2 className="display mb-1 text-2xl">{tr("Bestyrelse og kontaktpersoner")}</h2>
        <p className="mb-4 text-sm text-slate">{tr("Vises p\xE5 jeres side under Kontakt. I vedligeholder den selv \u2014 der skal ikke sendes en mail til os, n\xE5r kassereren skifter.")}


                </p>
        <PeopleForm people={club.people as any} />
      </section>}
</>}
{section === 'oversigt' && <>
  {toEnter.length > 0 && <Link href="/admin/bookinger" className="block rounded-xl border border-court/30 bg-court/5 p-4 font-semibold">{toEnter.length}{" " + tr("bookinger skal f\xF8res ind i jeres system \u2192")}</Link>}
  {!selectedSports.length && <Link href="/admin/baner" className="block rounded-xl bg-court/5 p-4 font-semibold">{tr("Kom i gang: V\xE6lg sportsgrene og opret baner eller borde \u2192")}</Link>}
  {stripeOn && !club.stripeChargesEnabled && <Link href="/admin/betaling" className="block rounded-xl bg-court/5 p-4 font-semibold">{tr("Ops\xE6t udbetalinger, s\xE5 g\xE6ster kan betale \u2192")}</Link>}
  <div className="grid gap-3 sm:grid-cols-2">{ADMIN_PAGES.filter((p) => clubHasSection(club.solutionMode, p.id, club.customFeatures)).filter((p) => p.id !== 'oversigt').map((p) => <Link key={p.id} href={adminHref(p.id)} className="rounded-2xl border border-slate/15 bg-white p-5 hover:border-court focus-visible:outline-court"><h2 className="font-bold">{p.id === 'baner' ? tr(facilityLabel(selectedSports)) + ' ' + tr('og sportsgrene') : phrase(p.label, prefs.locale)} <span aria-hidden="true">→</span></h2><p className="mt-2 text-sm text-slate">{phrase(p.description, prefs.locale)}</p></Link>)}</div>
</>}
{section === 'tider' && club.integrationType !== 'MANUAL' && <div className="card"><p>{tr("Ledige tider styres gennem klubbens bookingsystem.")}</p><Link href="/admin/integrationer" className="font-semibold text-court underline">{tr("\xC5bn bookingsystemets indstillinger")}</Link></div>}
</div></div></div></InternationalProvider>);

}
